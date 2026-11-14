import { jsonResponse } from './database.mjs';

const API_URL = 'https://api.twelvedata.com';
const EXCHANGES = new Set(['NSE', 'BSE']);

export class MarketDataError extends Error {
  constructor(message, status = 503, code = 'MARKET_DATA_UNAVAILABLE') {
    super(message);
    this.name = 'MarketDataError';
    this.status = status;
    this.code = code;
  }
}

export function parseIndianSymbol(value) {
  const symbol = typeof value === 'string' ? value.trim().toUpperCase() : '';
  const match = symbol.match(/^([A-Z0-9&._-]{1,32})(?:\.(NS|BO))?$/);
  if (!match) {
    throw new MarketDataError('Choose a valid NSE or BSE symbol.', 400, 'INVALID_SYMBOL');
  }
  return {
    symbol: match[1],
    exchange: match[2] === 'BO' ? 'BSE' : 'NSE',
  };
}

async function requestProvider(endpoint, params) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new MarketDataError(
      'Market data is not configured. Set the server-side TWELVE_DATA_API_KEY after enabling Indian exchange data.',
      503,
      'MARKET_DATA_NOT_CONFIGURED'
    );
  }

  const url = new URL(endpoint, API_URL);
  Object.entries({ ...params, apikey: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  let response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new MarketDataError('The market data provider could not be reached.', 502);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new MarketDataError('The market data provider returned an invalid response.', 502);
  }

  if (!response.ok || data.status === 'error' || data.code) {
    const message = typeof data.message === 'string' ? data.message : '';
    throw new MarketDataError(
      message || 'The market data provider could not fulfill this request.',
      response.status === 429 ? 503 : 502,
      response.status === 429 ? 'MARKET_DATA_RATE_LIMIT' : 'MARKET_DATA_PROVIDER_ERROR'
    );
  }
  return data;
}

export async function getTwelveDataQuote(value) {
  const { symbol, exchange } = parseIndianSymbol(value);
  const data = await requestProvider('/quote', { symbol, exchange });
  const price = Number(data.close);
  const previousClose = Number(data.previous_close);
  if (!Number.isFinite(price) || price <= 0) {
    throw new MarketDataError('No valid current quote was returned for this symbol.', 502);
  }
  return {
    symbol: `${symbol}.${exchange === 'BSE' ? 'BO' : 'NS'}`,
    name: data.name || symbol,
    exchange,
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    change: Number.isFinite(Number(data.change)) ? Number(data.change) : null,
    percentChange: Number.isFinite(Number(data.percent_change)) ? Number(data.percent_change) : null,
    currency: data.currency || 'INR',
    timestamp: data.timestamp || null,
    source: 'Twelve Data',
    delay: 'Provider entitlement dependent',
  };
}

function getRoute(requestUrl) {
  const segments = requestUrl.pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('market');
  return apiIndex === -1 ? '' : segments[apiIndex + 1] || '';
}

function normalizeSearchResult(item) {
  const exchange = String(item.exchange || '').toUpperCase();
  if (!EXCHANGES.has(exchange) || String(item.country || '').toLowerCase() !== 'india') {
    return null;
  }
  const symbol = String(item.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9&._-]{1,32}$/.test(symbol)) return null;
  return {
    symbol: `${symbol}.${exchange === 'BSE' ? 'BO' : 'NS'}`,
    shortname: item.instrument_name || symbol,
    longname: item.instrument_name || symbol,
    exchDisp: exchange,
    quoteType: item.type || 'Common Stock',
    currency: item.currency || 'INR',
    source: 'Twelve Data',
  };
}

function indexQuote(symbol, name, exchange) {
  return requestProvider('/quote', { symbol, exchange }).then((data) => {
    const price = Number(data.close);
    if (!Number.isFinite(price) || price <= 0) {
      throw new MarketDataError(`No current quote is available for ${name}.`, 502);
    }
    return {
      name,
      symbol,
      exchange,
      price,
      change: Number(data.change),
      percentChange: Number(data.percent_change),
      timestamp: data.timestamp || null,
      source: 'Twelve Data',
    };
  });
}

export default async function handleTwelveDataRequest(request) {
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Only GET requests are supported.' }, { allow: 'GET' });
  }

  const url = new URL(request.url);
  const route = getRoute(url);
  try {
    if (route === 'search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query || query.length < 2 || query.length > 80) {
        return jsonResponse(400, { error: 'Search needs between 2 and 80 characters.' });
      }
      const data = await requestProvider('/symbol_search', { symbol: query });
      const results = (Array.isArray(data.data) ? data.data : [])
        .map(normalizeSearchResult)
        .filter(Boolean)
        .filter((item, index, list) => list.findIndex((entry) => entry.symbol === item.symbol) === index)
        .slice(0, 25);
      return jsonResponse(200, { results, source: 'Twelve Data' });
    }

    if (route === 'quote') {
      const symbol = url.searchParams.get('symbol');
      if (!symbol) return jsonResponse(400, { error: 'A stock symbol is required.' });
      return jsonResponse(200, await getTwelveDataQuote(symbol));
    }

    if (route === 'history') {
      const { symbol, exchange } = parseIndianSymbol(url.searchParams.get('symbol'));
      const interval = url.searchParams.get('interval') || '1day';
      const allowedIntervals = new Set(['1min', '5min', '15min', '30min', '1h', '1day', '1week', '1month']);
      if (!allowedIntervals.has(interval)) {
        return jsonResponse(400, { error: 'Unsupported chart interval.' });
      }
      const outputsize = Math.min(500, Math.max(1, Number(url.searchParams.get('outputsize')) || 100));
      const data = await requestProvider('/time_series', {
        symbol,
        exchange,
        interval,
        outputsize,
        order: 'ASC',
        timezone: 'Asia/Kolkata',
      });
      const series = (Array.isArray(data.values) ? data.values : []).map((item) => ({
        time: item.datetime,
        price: Number(item.close),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        volume: Number(item.volume),
      })).filter((item) => Number.isFinite(item.price));
      if (series.length === 0) {
        throw new MarketDataError('No historical prices were returned for this symbol.', 502);
      }
      return jsonResponse(200, {
        symbol: `${symbol}.${exchange === 'BSE' ? 'BO' : 'NS'}`,
        name: data.meta?.name || symbol,
        exchange,
        currency: data.meta?.currency || 'INR',
        interval,
        series,
        source: 'Twelve Data',
        delay: 'Provider entitlement dependent',
      });
    }

    if (route === 'indices') {
      const indexRequests = [
        ['NIFTY 50', 'NIFTY', 'NSE'],
        ['SENSEX', 'SENSEX', 'BSE'],
        ['BANK NIFTY', 'BANKNIFTY', 'NSE'],
      ];
      const indices = await Promise.all(indexRequests.map(async ([name, symbol, exchange]) => {
        try {
          return await indexQuote(symbol, name, exchange);
        } catch (error) {
          return { name, symbol, exchange, error: error.message };
        }
      }));
      return jsonResponse(200, { indices, source: 'Twelve Data' });
    }

    return jsonResponse(404, { error: 'Unknown market data endpoint.' });
  } catch (error) {
    if (error instanceof MarketDataError) {
      return jsonResponse(error.status, { error: error.message, code: error.code });
    }
    console.error('Market data request failed:', error);
    return jsonResponse(500, { error: 'Could not load market data.' });
  }
}