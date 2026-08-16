import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { analyzeI797File, analyzeSyntheticI797, structureIntake } from './intelligenceRuntime.js';
import { handleCheckpointApi } from './checkpointApi.js';

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

function json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}

function presentEvidenceFeed(feed: unknown) {
  if (!feed || typeof feed !== 'object') return feed;
  const sourceFeed = feed as { sources?: unknown[]; [key: string]: unknown };
  if (!Array.isArray(sourceFeed.sources)) return feed;

  return {
    ...sourceFeed,
    sources: sourceFeed.sources.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const source = item as Record<string, unknown>;
      if (source.id !== 'visa-bulletin-2026-08' || source.status !== 'error') return source;

      return {
        ...source,
        status: 'refresh-blocked',
        sourceVersion: source.sourceVersion ?? 'August 2026 · refresh blocked',
        retrievalMode: source.retrievalMode ?? 'official-source-refresh-blocked',
        originalStatus: 'error',
        provenanceNote: 'The official source is registered, but the latest automated cloud refresh could not reach the source host. No successful verification is inferred from this state.',
      };
    }),
  };
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 12 * 1024 * 1024) throw new Error('Demo request exceeds 12 MB.');
    chunks.push(buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : {};
}

async function latestFeed() {
  if (!process.env.REDIS_URL) return null;
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  try {
    const raw = await redis.get(LATEST_FEED_KEY);
    return raw ? presentEvidenceFeed(JSON.parse(raw) as unknown) : null;
  } finally {
    redis.disconnect();
  }
}

async function serveStatic(request: IncomingMessage, response: ServerResponse) {
  if (!existsSync(distDir)) return json(response, 503, { error: 'frontend-not-built' });
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const candidate = decodeURIComponent(requestUrl.pathname) === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
  const safeCandidate = normalize(candidate).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = resolve(distDir, safeCandidate);
  if (!filePath.startsWith(`${distDir}${sep}`) && filePath !== distDir) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    filePath = join(distDir, 'index.html');
  }
  response.writeHead(200, {
    'content-type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(response);
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/healthz') return json(response, 200, { status: 'ok', service: 'cristovao-web' });

    if (request.method === 'GET' && url.pathname === '/api/evidence/latest') {
      const feed = await latestFeed();
      return feed ? json(response, 200, feed, { 'x-cristovao-feed-origin': 'render-key-value' }) : json(response, 404, { error: 'feed-unavailable' });
    }

    if (request.method === 'POST' && url.pathname === '/api/intake/structure') {
      const payload = await body(request);
      const input = typeof payload.input === 'string' ? payload.input.trim() : '';
      return input ? json(response, 200, await structureIntake(input.slice(0, 12_000))) : json(response, 400, { error: 'input-required' });
    }

    if (request.method === 'POST' && url.pathname === '/api/document/extract') {
      const payload = await body(request);
      if (payload.synthetic !== true) return json(response, 400, { error: 'synthetic-demo-only' });
      if (typeof payload.syntheticText === 'string' && payload.syntheticText.trim()) {
        return json(response, 200, analyzeSyntheticI797(payload.syntheticText.slice(0, 50_000)));
      }
      const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType : '';
      const data = typeof payload.data === 'string' ? payload.data : '';
      if (mimeType && data && !process.env.GEMINI_API_KEY) {
        return json(response, 503, {
          error: 'document-extraction-unavailable',
          message: 'Uploaded-document extraction is not configured on this deployment. Use the synthetic I-797 demo or ask the site administrator to enable document extraction.',
        });
      }
      return mimeType && data
        ? json(response, 200, await analyzeI797File(mimeType, data))
        : json(response, 400, { error: 'document-data-required' });
    }

    if (await handleCheckpointApi(request, response, url, json, body)) return;

    if (request.method === 'GET' && url.pathname === '/source-intelligence.json') {
      const feed = await latestFeed();
      if (feed) return json(response, 200, feed, { 'x-cristovao-feed-origin': 'render-key-value' });
    }

    if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'not-found' });
    await serveStatic(request, response);
  } catch (error) {
    json(response, 500, { error: 'request-failed', message: error instanceof Error ? error.message : String(error) });
  }
}).listen(PORT, HOST, () => {
  console.log(`Cristovao web service listening on http://${HOST}:${PORT}`);
});
