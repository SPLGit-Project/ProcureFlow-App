import { createServer } from 'node:http';
import { createReadStream, realpathSync } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8',
};

// A missing asset must never be replaced with the SPA document. Browsers reject
// HTML as a module, leaving the page blank before React can handle the error.
export function createProductionServer({ root = defaultRoot } = {}) {
  const staticRoot = realpathSync.native(root);
  const insideRoot = (path) => path.startsWith(staticRoot + sep);
  const sendError = (response, status, message, head = false) => {
    response.writeHead(status, {
      'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(head ? undefined : message);
  };

  return createServer(async (request, response) => {
    const head = request.method === 'HEAD';
    if (request.method !== 'GET' && !head) {
      response.setHeader('Allow', 'GET, HEAD');
      sendError(response, 405, 'Method not allowed');
      return;
    }

    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) {
        sendError(response, 404, 'Not found', head);
        return;
      }
      let file = resolve(staticRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!insideRoot(file)) {
        sendError(response, 404, 'Not found', head);
        return;
      }

      let details;
      try { details = await stat(file); } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
      if (!details?.isFile()) {
        const isNavigation = request.headers.accept?.includes('text/html') && !extname(pathname)
          && !/^\/(assets|icons|api)(\/|$)/.test(pathname);
        if (!isNavigation) {
          sendError(response, 404, 'Not found', head);
          return;
        }
        file = resolve(staticRoot, 'index.html');
        details = await stat(file);
      }
      if (!insideRoot(await realpath(file))) {
        sendError(response, 404, 'Not found', head);
        return;
      }

      const extension = extname(file).toLowerCase();
      const immutableAsset = pathname.startsWith('/assets/') && /\.[A-Za-z0-9_-]{8,}\.[^.]+$/.test(pathname);
      response.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', immutableAsset ? 'public, max-age=31536000, immutable' : 'no-store');
      response.setHeader('Accept-Ranges', 'bytes');

      let start = 0;
      let end = details.size - 1;
      let status = 200;
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (range && (range[1] || range[2])) {
          start = range[1] ? Number(range[1]) : Math.max(0, details.size - Number(range[2]));
          end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
          if (start > end || start >= details.size) {
            response.setHeader('Content-Range', `bytes */${details.size}`);
            sendError(response, 416, 'Range not satisfiable', head);
            return;
          }
          status = 206;
          response.setHeader('Content-Range', `bytes ${start}-${end}/${details.size}`);
        }
      }
      response.setHeader('Content-Length', details.size === 0 ? 0 : end - start + 1);
      response.writeHead(status);
      if (head || details.size === 0) { response.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      if (!response.headersSent) sendError(response, error instanceof URIError ? 400 : 500, 'Unable to serve request', head);
      else response.destroy();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 8080);
  createProductionServer().listen(port, '0.0.0.0', () => console.log(`ProcureFlow listening on port ${port}`));
}
