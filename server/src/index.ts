import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const LATEST_FEED_KEY = 'cristovao:feed:latest';
const serverDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectRoot = resolve(serverDir, '..');
const distDir = join(projectRoot, 'dist');

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function readLatestFeed() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      ok: false as const,
      status: 503,
      body: {
        error: 'live-feed-unavailable',
        message: 'REDIS_URL is not configured for the evidence API.',
      },
    };
  }

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  try {
    const raw = await redis.get(LATEST_FEED_KEY);
    if (!raw) {
      return {
        ok: false as const,
        status: 404,
        body: {
          error: 'live-feed-empty',
          message: 'No workflow evidence feed has been published yet.',
        },
      };
    }

    return { ok: true as const, status: 200, body: JSON.parse(raw) as unknown };
  } catch (error) {
    return {
      ok: false as const,
      status: 503,
      body: {
        error: 'live-feed-read-failed',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    redis.disconnect();
  }
}

async function serveStatic(request: IncomingMessage, response: ServerResponse) {
  if (!existsSync(distDir)) {
    writeJson(response, 503, {
      error: 'frontend-not-built',
      message: 'Run npm run build before starting the production web service.',
    });
    return;
  }

  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const candidate = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const normalizedCandidate = normalize(candidate).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = resolve(distDir, normalizedCandidate);
  const distPrefix = `${distDir}${sep}`;

  if (!filePath.startsWith(distPrefix) && filePath !== distDir) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(distDir, 'index.html');
  }

  response.writeHead(200, {
    'content-type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
    writeJson(response, 200, { status: 'ok', service: 'cristovao-evidence-api' });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/evidence/latest') {
    const result = await readLatestFeed();
    writeJson(
      response,
      result.status,
      result.body,
      result.ok ? { 'x-cristovao-feed-origin': 'render-key-value' } : {},
    );
    return;
  }

  // The current React app already consumes this contract. In production we make
  // the same URL live without coupling browser code to Redis or Render internals.
  if (request.method === 'GET' && requestUrl.pathname === '/source-intelligence.json') {
    const result = await readLatestFeed();
    if (result.ok) {
      writeJson(response, 200, result.body, { 'x-cristovao-feed-origin': 'render-key-value' });
      return;
    }

    // Local development and degraded production mode keep the checked-in snapshot.
    await serveStatic(request, response);
    return;
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    writeJson(response, 404, { error: 'not-found' });
    return;
  }

  await serveStatic(request, response);
});

server.listen(PORT, HOST, () => {
  console.log(`Cristovao web service listening on http://${HOST}:${PORT}`);
});
