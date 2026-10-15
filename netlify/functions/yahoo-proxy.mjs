const yahooFinanceUrl = 'https://query1.finance.yahoo.com';

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async (request) => {
  if (request.method !== 'GET') {
    return jsonError(405, 'Only GET requests are supported.');
  }

  const requestUrl = new URL(request.url);
  const route = requestUrl.pathname
    .split('/')
    .slice(3)
    .filter(Boolean);

  let upstreamPath;
  if (route.length === 1 && route[0] === 'search') {
    upstreamPath = '/v1/finance/search';
  } else if (
    route.length === 2 &&
    (route[0] === 'chart' || route[0] === 'fundamentals') &&
    /^[A-Za-z0-9.^&=_-]{1,32}$/.test(route[1])
  ) {
    const symbol = encodeURIComponent(route[1]);
    upstreamPath =
      route[0] === 'chart'
        ? `/v8/finance/chart/${symbol}`
        : `/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}`;
  } else {
    return jsonError(404, 'Unknown stock data endpoint.');
  }

  const upstreamUrl = new URL(upstreamPath, yahooFinanceUrl);
  upstreamUrl.search = requestUrl.search;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 TradeNexusIndia/1.0',
      },
    });
  } catch {
    return jsonError(502, 'Stock data provider is temporarily unavailable.');
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  headers.set('cache-control', 'public, max-age=30');

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
};
