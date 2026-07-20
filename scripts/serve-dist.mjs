import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT) || 10000;
const host = '0.0.0.0';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const sendFile = async (response, filePath, method) => {
  const body = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();

  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  });

  response.end(method === 'HEAD' ? undefined : body);
};

const server = createServer(async (request, response) => {
  const method = request.method || 'GET';
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);

  if (pathname === '/health') {
    const body = JSON.stringify({ status: 'ok' });
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store'
    });
    response.end(method === 'HEAD' ? undefined : body);
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
  let requestedPath = path.resolve(distDir, relativePath);

  if (requestedPath !== distDir && !requestedPath.startsWith(`${distDir}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStats = await stat(requestedPath);
    if (fileStats.isDirectory()) requestedPath = path.join(requestedPath, 'index.html');
    await sendFile(response, requestedPath, method);
    return;
  } catch {
    // React Router routes fall back to the built index page. Missing asset files do not.
    if (!path.extname(relativePath)) {
      try {
        await sendFile(response, path.join(distDir, 'index.html'), method);
        return;
      } catch {
        // Continue to the deployment error below.
      }
    }
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not Found');
});

server.listen(port, host, () => {
  console.log(`Clinic portal listening on http://${host}:${port}`);
});
