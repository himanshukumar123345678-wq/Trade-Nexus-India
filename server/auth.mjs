import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import {
  databaseErrorResponse,
  getDatabasePool,
  jsonResponse,
} from './database.mjs';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'trade_nexus_session';
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_WATCHLIST = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS'];

export class AuthenticationError extends Error {
  constructor(message = 'Please sign in to continue.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readSessionCookie(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  return cookie ? cookie.slice(SESSION_COOKIE.length + 1) : '';
}

function normalizeIdentifier(identifier) {
  const value = typeof identifier === 'string' ? identifier.trim() : '';
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid email address or mobile number.');
    }
    return email;
  }

  const mobile = value.replace(/[\s()+-]/g, '');
  if (!/^\d{7,15}$/.test(mobile)) {
    throw new Error('Enter a valid email address or mobile number.');
  }
  return mobile;
}

function getSessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`;
}

function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

async function passwordHash(password, salt) {
  return scrypt(password, salt, 64);
}

export async function requireAuthenticatedUser(request) {
  const token = readSessionCookie(request);
  if (!token || token.length > 128) {
    throw new AuthenticationError();
  }

  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT users.id, users.login_identifier
     FROM tn_sessions AS sessions
     JOIN tn_users AS users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [hashSessionToken(token)]
  );

  if (!rows.length) {
    throw new AuthenticationError();
  }

  return { id: rows[0].id, identifier: rows[0].login_identifier };
}

async function createSession(pool, userId, identifier, request) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await pool.execute(
    'INSERT INTO tn_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [hashSessionToken(token), userId, expiresAt]
  );

  return jsonResponse(
    200,
    { account: { id: userId, identifier } },
    { 'set-cookie': getSessionCookie(token, request) }
  );
}

export default async function handleAuthRequest(request) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (!readSessionCookie(request)) {
      return jsonResponse(200, { account: null });
    }

    try {
      const account = await requireAuthenticatedUser(request);
      return jsonResponse(200, { account });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return jsonResponse(401, { error: error.message, code: 'AUTH_REQUIRED' });
      }
      return databaseErrorResponse(error);
    }
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Only GET and POST requests are supported.' }, { allow: 'GET, POST' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON.' });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(400, { error: 'Account details are invalid.' });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'logout') {
    const token = readSessionCookie(request);
    if (token) {
      try {
        await getDatabasePool().execute('DELETE FROM tn_sessions WHERE token_hash = ?', [hashSessionToken(token)]);
      } catch (error) {
        return databaseErrorResponse(error);
      }
    }
    return jsonResponse(200, { success: true }, { 'set-cookie': clearSessionCookie(request) });
  }

  if (action !== 'register' && action !== 'login') {
    return jsonResponse(400, { error: 'Choose sign in or create account.' });
  }

  let identifier;
  try {
    identifier = normalizeIdentifier(body.identifier);
  } catch (error) {
    return jsonResponse(400, { error: error.message });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const minimumPasswordLength = action === 'register' ? 10 : 1;
  if (password.length < minimumPasswordLength || password.length > 128) {
    return jsonResponse(400, { error: 'Password must be between 10 and 128 characters.' });
  }

  try {
    const pool = getDatabasePool();
    if (action === 'register') {
      const userId = randomUUID();
      const salt = randomBytes(16).toString('hex');
      const derivedHash = (await passwordHash(password, salt)).toString('hex');
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          'INSERT INTO tn_users (id, login_identifier, password_salt, password_hash) VALUES (?, ?, ?, ?)',
          [userId, identifier, salt, derivedHash]
        );
        await connection.execute(
          'INSERT INTO tn_virtual_accounts (user_id, balance) VALUES (?, 30000.00)',
          [userId]
        );
        for (const symbol of DEFAULT_WATCHLIST) {
          await connection.execute(
            'INSERT INTO tn_watchlist (user_id, symbol) VALUES (?, ?)',
            [userId, symbol]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
          return jsonResponse(409, { error: 'An account already exists for that email or mobile number.' });
        }
        throw error;
      } finally {
        connection.release();
      }
      return await createSession(pool, userId, identifier, request);
    }

    const [rows] = await pool.execute(
      'SELECT id, password_salt, password_hash FROM tn_users WHERE login_identifier = ? LIMIT 1',
      [identifier]
    );
    if (!rows.length) {
      return jsonResponse(401, { error: 'The email/mobile number or password is incorrect.' });
    }
    const expectedHash = Buffer.from(rows[0].password_hash, 'hex');
    const actualHash = await passwordHash(password, rows[0].password_salt);
    if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
      return jsonResponse(401, { error: 'The email/mobile number or password is incorrect.' });
    }
    return await createSession(pool, rows[0].id, identifier, request);
  } catch (error) {
    return databaseErrorResponse(error);
  }
}