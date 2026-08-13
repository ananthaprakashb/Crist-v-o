import type { IncomingMessage, ServerResponse } from 'node:http';
import { assertContainerId, compareSnapshots, readCheckpoint, saveCheckpoint } from './checkpointStore.js';

type JsonWriter = (response: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) => void;
type BodyReader = (request: IncomingMessage) => Promise<Record<string, unknown>>;

export async function handleCheckpointApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  json: JsonWriter,
  body: BodyReader,
) {
  if (request.method === 'POST' && url.pathname === '/api/memory/checkpoint') {
    const payload = await body(request);
    const containerId = assertContainerId(payload.containerId);
    if (!payload.snapshot || typeof payload.snapshot !== 'object' || Array.isArray(payload.snapshot)) {
      json(response, 400, { error: 'snapshot-required' });
      return true;
    }
    json(response, 200, await saveCheckpoint(containerId, payload.snapshot as Record<string, unknown>));
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/memory/compare') {
    const payload = await body(request);
    const containerId = assertContainerId(payload.containerId);
    if (!payload.snapshot || typeof payload.snapshot !== 'object' || Array.isArray(payload.snapshot)) {
      json(response, 400, { error: 'snapshot-required' });
      return true;
    }
    const previous = await readCheckpoint(containerId);
    if (!previous) {
      json(response, 404, { error: 'checkpoint-not-found' });
      return true;
    }
    json(response, 200, {
      savedAt: previous.savedAt,
      comparison: compareSnapshots(previous.snapshot, payload.snapshot as Record<string, unknown>),
    });
    return true;
  }

  return false;
}
