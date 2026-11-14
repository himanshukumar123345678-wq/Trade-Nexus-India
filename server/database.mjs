import mysql from 'mysql2/promise';

let pool;

export class DatabaseConfigurationError extends Error {
  constructor(message = 'MySQL storage is not configured. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE.') {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export function getDatabasePool() {
  const host = process.env.MYSQL_HOST || process.env.mysql_host;
  const user = process.env.MYSQL_USER || process.env.mysql_user;
  const password = process.env.MYSQL_PASSWORD || process.env.mysql_password;
  const database = process.env.MYSQL_DATABASE || process.env.mysql_database;
  const port = process.env.MYSQL_PORT || process.env.mysql_port;

  if (!host || !user || !password || !database) {
    throw new DatabaseConfigurationError();
  }

  const parsedPort = Number(port || 3306);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new DatabaseConfigurationError('MYSQL_PORT must be an integer between 1 and 65535.');
  }

  if (!pool) {
    pool = mysql.createPool({
      host,
      port: parsedPort,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 5,
      decimalNumbers: true,
    });
  }

  return pool;
}

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function databaseErrorResponse(error) {
  if (error instanceof DatabaseConfigurationError) {
    return jsonResponse(503, { error: error.message, code: 'STORAGE_NOT_CONFIGURED' });
  }

  console.error('Database request failed:', error);
  return jsonResponse(500, { error: 'Could not complete the account request.' });
}