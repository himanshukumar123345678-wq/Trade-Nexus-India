import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const yahooFinanceProxy = {
  '/api/yahoo/search': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/yahoo\/search/, '/v1/finance/search'),
  },
  '/api/yahoo/chart': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/yahoo\/chart/, '/v8/finance/chart'),
  },
  '/api/yahoo/fundamentals': {
    target: 'https://query1.finance.yahoo.com',
    changeOrigin: true,
    rewrite: (path) =>
      path.replace(
        /^\/api\/yahoo\/fundamentals/,
        '/ws/fundamentals-timeseries/v1/finance/timeseries'
      ),
  },
};

function localTradeStorageFallback() {
  const respond = (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/api/trade' && pathname !== '/api/trades') {
      next();
      return;
    }

    if (
      (pathname === '/api/trade' && request.method !== 'POST') ||
      (pathname === '/api/trades' && request.method !== 'GET')
    ) {
      response.statusCode = 405;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Method not allowed.' }));
      return;
    }

    response.statusCode = 503;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Trade storage is not configured.' }));
  };

  return {
    name: 'local-trade-storage-fallback',
    configureServer(server) {
      server.middlewares.use(respond);
    },
    configurePreviewServer(server) {
      server.middlewares.use(respond);
    },
  };
}

export default defineConfig({
  plugins: [react(), localTradeStorageFallback()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '.loca.lt'],
    watch: {
      ignored: ['**/public/TradeNexus-India.apk'],
    },
    proxy: yahooFinanceProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '.loca.lt'],
    proxy: yahooFinanceProxy,
  },
});
