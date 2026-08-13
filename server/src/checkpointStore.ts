import { Redis } from 'ioredis';

type Snapshot = Record<string, unknown>;

interface StoredCheckpoint {
  savedAt: string;
  snapshot: Snapshot;
}

const local = new Map<string, StoredCheckpoint>();
const KEY_PREFIX = 'cristovao:checkpoint:';

function validContainerId(value: string) {
  return /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

export function assertContainerId(value: unknown) {
  if (typeof value !== 'string' || !validContainerId(value)) throw new Error('invalid-container-id');
  return value;
}

async function withRedis<T>(run: (redis: Redis) => Promise<T>): Promise<T | undefined> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined;
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  try {
    return await run(redis);
  } finally {
    redis.disconnect();
  }
}

export async function readCheckpoint(containerId: string): Promise<StoredCheckpoint | null> {
  const key = `${KEY_PREFIX}${containerId}`;
  const persisted = await withRedis((redis) => redis.get(key));
  if (typeof persisted === 'string') return JSON.parse(persisted) as StoredCheckpoint;
  return local.get(containerId) ?? null;
}

export async function saveCheckpoint(containerId: string, snapshot: Snapshot) {
  const record: StoredCheckpoint = { savedAt: new Date().toISOString(), snapshot };
  const key = `${KEY_PREFIX}${containerId}`;
  const persisted = await withRedis((redis) => redis.set(key, JSON.stringify(record)));
  if (persisted === undefined) local.set(containerId, record);
  const semantic = await ingestSemanticHistory(containerId, record);
  return {
    ...record,
    persistence: persisted === undefined ? 'ephemeral' : 'render-key-value',
    semantic,
  };
}

function listById(value: unknown) {
  if (!Array.isArray(value)) return new Map<string, Record<string, unknown>>();
  return new Map(
    value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string')
      .map((item) => [String(item.id), item]),
  );
}

function comparableValue(item: Record<string, unknown>) {
  return JSON.stringify({
    value: item.value,
    status: item.status,
    verificationStatus: item.verificationStatus,
    impact: item.impact,
    evidenceStatus: item.evidenceStatus,
  });
}

function diffCollection(previous: unknown, current: unknown) {
  const before = listById(previous);
  const after = listById(current);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [id, item] of after) {
    if (!before.has(id)) added.push(id);
    else if (comparableValue(before.get(id)!) !== comparableValue(item)) changed.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  return { added, removed, changed };
}

export function compareSnapshots(previous: Snapshot, current: Snapshot) {
  return {
    facts: diffCollection(previous.facts, current.facts),
    unknowns: diffCollection(previous.unknowns, current.unknowns),
    nodes: diffCollection(previous.nodes, current.nodes),
    evidence: diffCollection(previous.evidence, current.evidence),
  };
}

async function ingestSemanticHistory(containerId: string, record: StoredCheckpoint) {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (!apiKey) return { status: 'not-configured' as const };

  const response = await fetch('https://api.supermemory.ai/v3/documents', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: JSON.stringify({ capturedAt: record.savedAt, snapshot: record.snapshot }),
      containerTag: `cristovao_${containerId}`,
      entityContext: 'Synthetic Cristovao journey history. Preserve explicit facts, unknowns, graph state, and evidence state without inventing missing values.',
      metadata: { app: 'cristovao', type: 'journey-checkpoint', capturedAt: record.savedAt },
      taskType: 'memory',
    }),
  });

  if (!response.ok) return { status: 'error' as const, httpStatus: response.status };
  const result = await response.json() as { id?: string; status?: string };
  return { status: 'submitted' as const, id: result.id, processingStatus: result.status };
}
