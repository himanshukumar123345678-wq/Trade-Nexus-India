import test from 'node:test';
import assert from 'node:assert/strict';
import handleAuthRequest from '../server/auth.mjs';
import { getDatabasePool, DatabaseConfigurationError } from '../server/database.mjs';
import { createServerlessHandler } from '../api/_serverless-handler.js';

const mysqlVariables = [
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
];

async function withoutMysqlConfiguration(run) {
  const previous = new Map(mysqlVariables.map((name) => [name, process.env[name]]));
  mysqlVariables.forEach((name) => delete process.env[name]);
  try {
    return await run();
  } finally {
    previous.forEach((value, name) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
}

test('sign-in accepts existing passwords shorter than the registration minimum', async () => {
  await withoutMysqlConfiguration(async () => {
    const response = await handleAuthRequest(new Request('https://app.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        identifier: '9876543210',
        password: 'legacy8!',
      }),
    }));

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'STORAGE_NOT_CONFIGURED');
  });
});

test('registration still enforces the password minimum and never succeeds without storage', async () => {
  await withoutMysqlConfiguration(async () => {
    const shortPassword = await handleAuthRequest(new Request('https://app.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        identifier: '9876543210',
        password: 'short',
      }),
    }));
    assert.equal(shortPassword.status, 400);

    const validPassword = await handleAuthRequest(new Request('https://app.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        identifier: '9876543210',
        password: 'valid-password',
      }),
    }));
    assert.equal(validPassword.status, 503);
    assert.equal((await validPassword.json()).code, 'STORAGE_NOT_CONFIGURED');
  });
});

test('session restore and logout preserve explicit signed-out behavior', async () => {
  await withoutMysqlConfiguration(async () => {
    const session = await handleAuthRequest(new Request('https://app.test/api/auth'));
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { account: null });

    const logout = await handleAuthRequest(new Request('https://app.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }));
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  });
});

test('invalid MySQL port is rejected as configuration without opening a connection', () => {
  const previous = new Map(mysqlVariables.map((name) => [name, process.env[name]]));
  process.env.MYSQL_HOST = 'db.example.test';
  process.env.MYSQL_USER = 'app';
  process.env.MYSQL_PASSWORD = 'not-a-real-password';
  process.env.MYSQL_DATABASE = 'trade_nexus';
  process.env.MYSQL_PORT = '70000';
  try {
    assert.throws(getDatabasePool, DatabaseConfigurationError);
  } finally {
    previous.forEach((value, name) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
});

test('Vercel request adapter forwards parsed JSON bodies and response cookies', async () => {
  await withoutMysqlConfiguration(async () => {
    const request = {
      method: 'POST',
      url: '/api/auth',
      headers: { host: 'app.test', 'content-type': 'application/json' },
      body: { action: 'logout' },
    };
    const response = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(body) {
        this.body = body;
      },
    };

    await createServerlessHandler(handleAuthRequest)(request, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { success: true });
    assert.match(response.headers['set-cookie'], /Max-Age=0/);
  });
});
