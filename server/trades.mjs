import {
  AuthenticationError,
  requireAuthenticatedUser,
} from './auth.mjs';
import {
  databaseErrorResponse,
  getDatabasePool,
  jsonResponse,
} from './database.mjs';
import { calculateHoldings, validatePaperOrder } from './portfolio.mjs';
import { getTwelveDataQuote, MarketDataError } from './twelvedata.mjs';

async function getAccount(request) {
  try {
    return { account: await requireAuthenticatedUser(request) };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { response: jsonResponse(401, { error: error.message, code: 'AUTH_REQUIRED' }) };
    }
    return { response: databaseErrorResponse(error) };
  }
}

export default async function handleTradesRequest(request) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(405, { error: 'Only GET and POST requests are supported.' }, { allow: 'GET, POST' });
  }

  const { account, response } = await getAccount(request);
  if (response) return response;

  const pool = getDatabasePool();
  if (request.method === 'GET') {
    try {
      const [accounts] = await pool.execute(
        'SELECT balance FROM tn_virtual_accounts WHERE user_id = ? LIMIT 1',
        [account.id]
      );
      if (!accounts.length) return jsonResponse(404, { error: 'Virtual account was not found.' });
      const [trades] = await pool.execute(
        `SELECT id, stock_name, transaction_type, quantity, price, trade_date
         FROM trades WHERE user_id = ? ORDER BY trade_date ASC, id ASC`,
        [account.id]
      );
      return jsonResponse(200, { cash: Number(accounts[0].balance), trades });
    } catch (error) {
      return databaseErrorResponse(error);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON.' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(400, { error: 'Order details are invalid.' });
  }

  let quote;
  try {
    quote = await getTwelveDataQuote(body.stockName);
  } catch (error) {
    if (error instanceof MarketDataError) {
      return jsonResponse(error.status, { error: error.message, code: error.code });
    }
    console.error('Could not validate current market price:', error);
    return jsonResponse(502, { error: 'Could not verify the current market price.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [accounts] = await connection.execute(
      'SELECT balance FROM tn_virtual_accounts WHERE user_id = ? FOR UPDATE',
      [account.id]
    );
    if (!accounts.length) {
      await connection.rollback();
      return jsonResponse(404, { error: 'Virtual account was not found.' });
    }
    const [trades] = await connection.execute(
      `SELECT stock_name, transaction_type, quantity, price
       FROM trades WHERE user_id = ? ORDER BY trade_date ASC, id ASC`,
      [account.id]
    );
    const cash = Number(accounts[0].balance);
    let order;
    try {
      order = validatePaperOrder({
        stockName: quote.symbol,
        type: body.type,
        quantity: body.quantity,
        price: quote.price,
      }, cash, calculateHoldings(trades).holdings);
    } catch (error) {
      await connection.rollback();
      return jsonResponse(400, { error: error.message });
    }

    const nextCash = Number((cash + (order.side === 'SELL' ? order.total : -order.total)).toFixed(2));
    const [result] = await connection.execute(
      'INSERT INTO trades (user_id, stock_name, transaction_type, quantity, price) VALUES (?, ?, ?, ?, ?)',
      [account.id, order.symbol, order.side, order.quantity, order.price]
    );
    await connection.execute(
      'UPDATE tn_virtual_accounts SET balance = ? WHERE user_id = ?',
      [nextCash, account.id]
    );
    await connection.commit();
    return jsonResponse(201, {
      id: Number(result.insertId),
      stock_name: order.symbol,
      transaction_type: order.side,
      quantity: order.quantity,
      price: order.price,
      trade_date: new Date().toISOString(),
      cash: nextCash,
      source: quote.source,
      quoteTimestamp: quote.timestamp,
    });
  } catch (error) {
    await connection.rollback();
    return databaseErrorResponse(error);
  } finally {
    connection.release();
  }
}
