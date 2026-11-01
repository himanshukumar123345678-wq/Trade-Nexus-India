import mysql from 'mysql2/promise';

let pool;

class MissingDatabaseConfigurationError extends Error {}

function jsonResponse(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function handleDatabaseInitializationError(error) {
  if (error instanceof MissingDatabaseConfigurationError) {
    console.error(error.message);
    return jsonResponse(503, { error: 'Trade storage is not configured.' });
  }

  console.error('Failed to initialize trade storage:', error);
  return jsonResponse(500, { error: 'Could not initialize trade storage.' });
}

function getDatabasePool() {
  const MYSQL_HOST = process.env.MYSQL_HOST || process.env.mysql_host;
  const MYSQL_USER = process.env.MYSQL_USER || process.env.mysql_user;
  const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || process.env.mysql_password;
  const MYSQL_DATABASE = process.env.MYSQL_DATABASE || process.env.mysql_database;
  const MYSQL_PORT = process.env.MYSQL_PORT || process.env.mysql_port;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    const missingVariables = [
      ['MYSQL_HOST', MYSQL_HOST],
      ['MYSQL_USER', MYSQL_USER],
      ['MYSQL_PASSWORD', MYSQL_PASSWORD],
      ['MYSQL_DATABASE', MYSQL_DATABASE],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    throw new MissingDatabaseConfigurationError(
      `MySQL connection environment variables are not configured: ${missingVariables.join(', ')}.`
    );
  }

  if (!pool) {
    pool = mysql.createPool({
      host: MYSQL_HOST,
      port: Number(MYSQL_PORT || 3306),
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  return pool;
}

export default async function handleTradesRequest(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse(405, { error: 'Only GET and POST requests are supported.' });
  }

  if (request.method === 'GET') {
    const userId = url.searchParams.get('userId')?.trim();
    if (!userId || userId.length > 255) {
      return jsonResponse(400, { error: 'A valid userId is required.' });
    }

    let db;
    try {
      db = getDatabasePool();
    } catch (error) {
      return handleDatabaseInitializationError(error);
    }

    try {
      const [trades] = await db.execute(
        'SELECT id, user_id, stock_name, transaction_type, quantity, price, trade_date FROM trades WHERE user_id = ? ORDER BY trade_date DESC',
        [userId]
      );
      return jsonResponse(200, trades);
    } catch (error) {
      console.error('Failed to fetch trades:', error);
      return jsonResponse(500, { error: 'Could not fetch trades.' });
    }
  }

  let trade;
  try {
    trade = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON.' });
  }

  if (!trade || typeof trade !== 'object' || Array.isArray(trade)) {
    return jsonResponse(400, { error: 'Trade details are invalid.' });
  }

  const userId = typeof trade.userId === 'string' ? trade.userId.trim() : '';
  const stockName = typeof trade.stockName === 'string' ? trade.stockName.trim() : '';
  const type = typeof trade.type === 'string' ? trade.type.trim().toUpperCase() : '';
  const quantity = Number(trade.quantity);
  const price = Number(trade.price);

  if (
    !userId ||
    userId.length > 255 ||
    !stockName ||
    stockName.length > 100 ||
    !['BUY', 'SELL'].includes(type) ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    quantity > 2147483647 ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 99999999.99
  ) {
    return jsonResponse(400, { error: 'Trade details are invalid.' });
  }

  let db;
  try {
    db = getDatabasePool();
  } catch (error) {
    return handleDatabaseInitializationError(error);
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO trades (user_id, stock_name, transaction_type, quantity, price) VALUES (?, ?, ?, ?, ?)',
      [userId, stockName, type, quantity, price]
    );
    return jsonResponse(201, {
      id: Number(result.insertId),
      user_id: userId,
      stock_name: stockName,
      transaction_type: type,
      quantity,
      price,
      trade_date: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to save trade:', error);
    return jsonResponse(500, { error: 'Could not save trade.' });
  }
}
