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

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '.loca.lt'],
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
