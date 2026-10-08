// Serves the actual request components against local fixtures. No application
// credentials, auth session or network-backed services are loaded.
import fs from 'node:fs';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const head = fs.readFileSync('index.html', 'utf8').match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<script id="startup-recovery">[\s\S]*?<\/script>/, '')
  .replace(/<link[^>]+rel="manifest"[^>]*>/g, '');
const html = `<!doctype html><html><head>${head}</head><body style="padding:20px;background:#f3f4f6">
  <div id="root"></div><script type="module" src="/tests/fixtures/order-packs-preview.tsx"></script></body></html>`;
const server = await createServer({ configFile: false, root: process.cwd(), publicDir: 'public',
  server: { host: '127.0.0.1', port: 3107, strictPort: true },
  plugins: [{
    name: 'pack-preview-fixtures', enforce: 'pre',
    transform(source, id) {
      const normalized = id.replaceAll('\\', '/');
      if (normalized.endsWith('/context/AppContext.tsx')) return "export { usePreviewApp as useApp } from '/tests/fixtures/order-packs-preview.tsx';";
      if (normalized.endsWith('/lib/supabaseClient.ts')) return "export const isSupabaseConfigured=false; export const supabase={};";
      if (normalized.endsWith('/services/db.ts')) return "export const db={};";
    },
    configureServer(dev) {
      dev.middlewares.use(async (req, res, next) => {
        if (req.url === '/' || req.url?.startsWith('/?')) {
          res.setHeader('Content-Type', 'text/html'); res.end(await dev.transformIndexHtml('/', html));
        } else next();
      });
    },
  }, react()],
});
await server.listen();
console.log('Fixture preview: http://localhost:3107/ (no live business writes)');
process.on('SIGINT', async () => { await server.close(); process.exit(0); });
