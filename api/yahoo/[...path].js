import handleYahooRequest from '../../server/yahoo.mjs';

export default async function yahooHandler(request, response) {
  try {
    const headers = new Headers();
    Object.entries(request.headers || {}).forEach(([name, value]) => {
      if (value !== undefined) {
        headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
      }
    });

    const url = new URL(request.url || '/', `https://${request.headers.host || 'localhost'}`);
    const apiRequest = new Request(url, {
      method: request.method || 'GET',
      headers,
    });
    const apiResponse = await handleYahooRequest(apiRequest);

    response.statusCode = apiResponse.status;
    apiResponse.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await apiResponse.text());
  } catch (error) {
    console.error('Failed to process stock data request:', error);
    response.statusCode = 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Could not load stock data.' }));
  }
}
