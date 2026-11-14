import {
  AuthenticationError,
  requireAuthenticatedUser,
} from './auth.mjs';
import {
  databaseErrorResponse,
  getDatabasePool,
  jsonResponse,
} from './database.mjs';

export default async function handleDepositsRequest(request) {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Only POST requests are supported.' }, { allow: 'POST' });
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

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON.' });
  }

  const amount = Number(body?.amount);
  const amountCents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amountCents < 1 || amountCents > 100000000) {
    return jsonResponse(400, { error: 'Enter a virtual deposit between ₹0.01 and ₹1,000,000.' });
  }

  const pool = getDatabasePool();
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

    const balance = Number(accounts[0].balance);
    const nextBalance = Number((balance + amountCents / 100).toFixed(2));
    await connection.execute(
      'UPDATE tn_virtual_accounts SET balance = ? WHERE user_id = ?',
      [nextBalance, account.id]
    );
    await connection.execute(
      'INSERT INTO tn_deposits (user_id, amount, is_simulated) VALUES (?, ?, 1)',
      [account.id, amountCents / 100]
    );
    await connection.commit();
    return jsonResponse(201, { balance: nextBalance, simulated: true });
  } catch (error) {
    await connection.rollback();
    return databaseErrorResponse(error);
  } finally {
    connection.release();
  }
}