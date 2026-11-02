import handleTradesRequest from '../server/trades.mjs';

async function readRequestBody(request) {
  if (request.body !== undefined) {
    return typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body);
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function tradeHandler(request, response) {
  try {
    const method = request.method || 'GET';
    const headers = new Headers();
    Object.entries(request.headers || {}).forEach(([name, value]) => {
      if (value !== undefined) {
        headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
      }
    });

    const url = new URL(request.url || '/', `https://${request.headers.host || 'localhost'}`);
    const body = method === 'GET' || method === 'HEAD'
      ? undefined
      : await readRequestBody(request);
    const apiRequest = new Request(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
    });
    const apiResponse = await handleTradesRequest(apiRequest);

    response.statusCode = apiResponse.status;
    apiResponse.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await apiResponse.text());
  } catch (error) {
    console.error('Failed to process trade API request:', error);
    response.statusCode = 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Could not process trade request.' }));
  }
}
