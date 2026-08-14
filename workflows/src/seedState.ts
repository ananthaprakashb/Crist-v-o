import { Redis } from 'ioredis';
import { referenceSeedFor } from './referenceSeed.js';

const SOURCE_ID = 'visa-bulletin-2026-08';
const SOURCE_KEY = `cristovao:source:${SOURCE_ID}`;
const FEED_KEY = 'cristovao:feed:latest';

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    return null;
  }
}

export async function seedReferenceStateIfNeeded() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  try {
    const seed = referenceSeedFor(SOURCE_ID);
    if (!seed) return;

    const existingSource = parseJson(await redis.get(SOURCE_KEY));
    const hasUsableSnapshot = Boolean(existingSource?.contentHash && existingSource?.status !== 'error');
    if (hasUsableSnapshot) return;

    await redis.set(SOURCE_KEY, JSON.stringify(seed));

    const existingFeed = parseJson(await redis.get(FEED_KEY));
    const sources = Array.isArray(existingFeed?.sources) ? [...existingFeed.sources] : [];
    const index = sources.findIndex((item) => item?.id === SOURCE_ID);
    const presentationSeed = {
      ...seed,
      error: existingSource?.error ?? sources[index]?.error,
    };
    if (index >= 0) sources[index] = presentationSeed;
    else sources.push(presentationSeed);

    const unresolved = new Set<string>(existingFeed?.summary?.unresolvedSourceIds ?? []);
    unresolved.add(SOURCE_ID);
    const feed = {
      ...(existingFeed ?? {}),
      generatedAt: existingFeed?.generatedAt ?? seed.retrievedAt,
      persistence: existingFeed?.persistence ?? 'render-key-value',
      sources,
      changedSourceIds: existingFeed?.changedSourceIds ?? [],
      changedNodeIds: existingFeed?.changedNodeIds ?? [],
      summary: {
        sourceCount: sources.length,
        verifiedSourceCount: sources.filter((item) => item?.semanticSupport === 'supported' && item?.status !== 'refresh-blocked').length,
        changedSourceCount: Array.isArray(existingFeed?.changedSourceIds) ? existingFeed.changedSourceIds.length : 0,
        unresolvedSourceIds: [...unresolved],
      },
    };
    await redis.set(FEED_KEY, JSON.stringify(feed));
    console.log(`Seeded ${SOURCE_ID} retained reference because no usable persisted snapshot was available.`);
  } catch (error) {
    console.warn('Reference source seed skipped:', error instanceof Error ? error.message : String(error));
  } finally {
    redis.disconnect();
  }
}
