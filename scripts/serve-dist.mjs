import { spawn } from 'node:child_process';
import { createServer, request as createProxyRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT) || 10000;
const host = '0.0.0.0';
const apiPort = Number(process.env.API_INTERNAL_PORT) || 10001;
const apiEnabled = Boolean(process.env.DATABASE_URL);

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

let apiProcess = null;

if (apiEnabled) {
  apiProcess = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(apiPort),
      PUBLIC_FRONTEND_URL: process.env.PUBLIC_FRONTEND_URL || 'https://occu-med-lab-supplies-clinic.onrender.com',
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'https://occu-med-lab-supplies-clinic.onrender.com'
    },
    stdio: 'inherit'
  });

  apiProcess.on('exit', (code, signal) => {
    console.error(`Embedded lab portal API exited (code=${code ?? 'none'}, signal=${signal ?? 'none'}).`);
    apiProcess = null;
  });
} else {
  console.warn('DATABASE_URL is not configured. The portal UI will run, but API requests will return 503.');
}

const sendJson = (response, statusCode, payload, method = 'GET') => {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(method === 'HEAD' ? undefined : body);
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

const isApiPath = (pathname) => (
  pathname === '/data'
  || pathname.startsWith('/data/')
  || pathname === '/auth'
  || pathname.startsWith('/auth/')
);

const proxyToEmbeddedApi = (request, response) => new Promise((resolve) => {
  const headers = { ...request.headers, host: `127.0.0.1:${apiPort}` };
  const forwardedProto = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const requestHost = String(request.headers.host || '').trim();
  const sameOrigin = requestHost ? `${forwardedProto}://${requestHost}` : '';

  // The embedded API does not need CORS validation for requests coming from
  // the same Render service. Preserve the Clinic portal origin so its
  // cross-origin requests are still explicitly checked by the API.
  if (headers.origin && sameOrigin && headers.origin === sameOrigin) {
    delete headers.origin;
  }

  const proxyRequest = createProxyRequest({
    hostname: '127.0.0.1',
    port: apiPort,
    method: request.method,
    path: request.url,
    headers
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(response);
    proxyResponse.on('end', resolve);
  });

  proxyRequest.setTimeout(30_000, () => {
    proxyRequest.destroy(new Error('Embedded API request timed out.'));
  });

  proxyRequest.on('error', (error) => {
    console.error('Embedded API proxy error:', error.message);
    if (!response.headersSent) {
      sendJson(response, 503, {
        error: 'The portal database service is starting or unavailable. Please try again in a moment.'
      }, request.method || 'GET');
    } else {
      response.end();
    }
    resolve();
  });

  request.pipe(proxyRequest);
});

const server = createServer(async (request, response) => {
  const method = request.method || 'GET';
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);

  if (pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'occu-med-lab-supplies-portal',
      apiConfigured: apiEnabled,
      apiRunning: Boolean(apiProcess)
    }, method);
    return;
  }

  if (isApiPath(pathname)) {
    if (!apiEnabled) {
      sendJson(response, 503, {
        error: 'DATABASE_URL is not configured on the Admin portal service.'
      }, method);
      return;
    }

    await proxyToEmbeddedApi(request, response);
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

const stop = (signal) => {
  if (apiProcess) apiProcess.kill(signal);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

server.listen(port, host, () => {
  console.log(`Lab portal listening on http://${host}:${port}`);
  console.log(`Embedded API ${apiEnabled ? `configured on internal port ${apiPort}` : 'disabled because DATABASE_URL is missing'}.`);
});
