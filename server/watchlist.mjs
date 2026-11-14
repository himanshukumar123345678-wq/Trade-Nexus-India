import {
  AuthenticationError,
  requireAuthenticatedUser,
} from './auth.mjs';
import {
  databaseErrorResponse,
  getDatabasePool,
  jsonResponse,
} from './database.mjs';

function validateSymbols(value) {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error('Watchlist must contain no more than 100 symbols.');
  }
  const symbols = [...new Set(value.map((symbol) =>
    typeof symbol === 'string' ? symbol.trim().toUpperCase() : ''
  ))];
  if (!symbols.every((symbol) => /^[A-Z0-9.^&=_-]{1,32}(?:\.(?:NS|BO))?$/.test(symbol))) {
    throw new Error('Watchlist contains an invalid stock symbol.');
  }
  return symbols;
}

export default async function handleWatchlistRequest(request) {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return jsonResponse(405, { error: 'Only GET and PUT requests are supported.' }, { allow: 'GET, PUT' });
  }

  let account;
  try {
    account = await requireAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonResponse(401, { error: error.message, code: 'AUTH_REQUIRED' });
    }
    return databaseErrorResponse(error);
  }

  const pool = getDatabasePool();
  if (request.method === 'GET') {
    try {
      const [rows] = await pool.execute(
        'SELECT symbol FROM tn_watchlist WHERE user_id = ? ORDER BY created_at, symbol',
        [account.id]
      );
      return jsonResponse(200, { symbols: rows.map((row) => row.symbol) });
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

  let symbols;
  try {
    symbols = validateSymbols(body?.symbols);
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM tn_watchlist WHERE user_id = ?', [account.id]);
    for (const symbol of symbols) {
      await connection.execute(
        'INSERT INTO tn_watchlist (user_id, symbol) VALUES (?, ?)',
        [account.id, symbol]
      );
    }
    await connection.commit();
    return jsonResponse(200, { symbols });
  } catch (error) {
    await connection.rollback();
    return databaseErrorResponse(error);
  } finally {
    connection.release();
  }
}