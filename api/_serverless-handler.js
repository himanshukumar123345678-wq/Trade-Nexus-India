export function createServerlessHandler(apiHandler) {
  return async function serverlessHandler(request, response) {
    try {
      const method = request.method || 'GET';
      const headers = new Headers();
      Object.entries(request.headers || {}).forEach(([name, value]) => {
        if (value !== undefined) {
          headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
        }
      });

      const url = new URL(request.url || '/', `https://${request.headers.host || 'localhost'}`);
      let body;
      if (method !== 'GET' && method !== 'HEAD') {
        if (request.body !== undefined) {
          body = typeof request.body === 'string'
            ? request.body
            : Buffer.isBuffer(request.body)
              ? request.body
              : JSON.stringify(request.body);
        } else {
          const chunks = [];
          for await (const chunk of request) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          body = Buffer.concat(chunks);
        }
      }

      const apiRequest = new Request(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
      });
      const apiResponse = await apiHandler(apiRequest);
      response.statusCode = apiResponse.status;
      apiResponse.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(await apiResponse.text());
    } catch (error) {
      console.error('Failed to process account API request:', error);
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Could not process account request.' }));
    }
  };
}
