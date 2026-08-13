import type { SourceIntelligenceFeed } from './sourceIntelligence';

export type SourceFeedOrigin = 'live-api' | 'static-fallback';

export interface SourceFeedLoadResult {
  feed: SourceIntelligenceFeed;
  origin: SourceFeedOrigin;
  warning?: string;
}

function apiUrl(path: string) {
  const configuredBase = import.meta.env.VITE_EVIDENCE_API_URL?.trim().replace(/\/$/, '');
  return configuredBase ? `${configuredBase}${path}` : path;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${url} returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }
  return response.json() as Promise<SourceIntelligenceFeed>;
}

export async function loadSourceIntelligenceFeed(): Promise<SourceFeedLoadResult> {
  try {
    const feed = await fetchJson(apiUrl('/api/evidence/latest'));
    return { feed, origin: 'live-api' };
  } catch (liveError) {
    const warning = liveError instanceof Error ? liveError.message : String(liveError);
    const feed = await fetchJson('/source-intelligence.json');
    return { feed, origin: 'static-fallback', warning };
  }
}
