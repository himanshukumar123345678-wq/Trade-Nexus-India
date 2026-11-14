# Deployment and account storage

The app is a React/Vite single-page client. Account, watchlist, virtual-cash, and trade state is stored in MySQL through serverless API handlers. Market charts and symbol search use the Twelve Data server-side API; Yahoo Finance currently supplies headlines only.

## Database setup

1. Create a MySQL database and user.
2. Apply [`database/schema.sql`](./database/schema.sql) to a new database. For an existing installation, back it up and apply migration 001 followed by [`database/migrations/002_add_accounts_and_watchlists.sql`](./database/migrations/002_add_accounts_and_watchlists.sql). These migrations add account tables and an index; they do not delete user or trade rows.
3. Configure `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` as server-side environment variables in the hosting provider. `MYSQL_PORT` is optional and defaults to `3306`. Never use a `VITE_` prefix or place production credentials in client-side variables.
4. Create a Twelve Data account with the appropriate Indian exchange data entitlements and configure its API key as the server-side `TWELVE_DATA_API_KEY`. Confirm the plan's delay, usage limits, and redistribution terms before launch.
5. For local development, copy `.env.example` to `.env.local`, fill in the MySQL connection values, then restart `npm run dev`. Vite loads these server-side values for the local API; they are not exposed to the browser. Account, watchlist, deposit, and trading APIs remain unavailable until a reachable MySQL database has been created and its schema applied.

Each account starts with ₹30,000 in simulated cash. Registration requires a valid email address or mobile number and a password of at least 10 characters. Passwords are stored as salted scrypt hashes; opaque sessions are stored hashed and sent only in HttpOnly, SameSite cookies. Paper trades and simulated deposits are committed with account balance updates in MySQL transactions. Without the required provider key the market-data API reports a configuration error; it never substitutes mock prices.

## Vercel

Import the repository into Vercel, use the included `vercel.json`, then open **Project Settings → Environment Variables** and add:

- `MYSQL_HOST` — hostname of the MySQL server reachable from Vercel
- `MYSQL_PORT` — MySQL port (usually `3306`; optional here)
- `MYSQL_USER` — database user with permissions for the app schema
- `MYSQL_PASSWORD` — that database user's password
- `MYSQL_DATABASE` — database/schema name

Select the Vercel environments where the app should work (Production, Preview, and/or Development), save, and redeploy so the serverless functions receive the values. The database provider must permit connections from the deployed app. Apply the schema/migrations before testing account creation. Deep links are rewritten to the SPA entry point and `api/` files remain serverless functions.

## Netlify

The included `netlify.toml` and `public/_redirects` route account API paths to Netlify Functions and deep links to the SPA. Add the same MySQL environment variables to the Netlify site before deploying.

## Local checks

Run `npm test` for auth request validation, session behavior, and Vercel adapter tests; run `npm run build` for the production bundle. Successful registration, password verification, and persisted-session tests require a reachable configured MySQL database and the account schema. The account APIs deliberately return an error when MySQL is not configured; they do not silently fall back to browser-local user or trade storage.
