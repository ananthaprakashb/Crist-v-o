import type { DigitalTwin } from './types';

export type SourceRunStatus = 'not-run' | 'first-snapshot' | 'unchanged' | 'changed' | 'error';

export interface SourceFeedRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  status: SourceRunStatus;
  retrievedAt?: string;
  sourceVersion?: string;
  contentHash?: string;
  previousHash?: string;
  affectedNodeIds: string[];
  changeSummary?: {
    added: string[];
    removed: string[];
  };
  error?: string;
}

export interface SourceIntelligenceFeed {
  generatedAt: string | null;
  sources: SourceFeedRecord[];
}

export interface SourceImpactResult {
  twin: DigitalTwin;
  changedNodeIds: string[];
  changedSourceIds: string[];
}

export function applySourceIntelligence(
  twin: DigitalTwin,
  feed?: SourceIntelligenceFeed | null,
): SourceImpactResult {
  if (!feed) {
    return { twin: structuredClone(twin), changedNodeIds: [], changedSourceIds: [] };
  }

  const nextTwin = structuredClone(twin);
  const changedNodeIds = new Set<string>();
  const changedSourceIds: string[] = [];

  for (const source of feed.sources) {
    const evidence = nextTwin.evidence.find((record) => record.id === source.id);

    if (evidence && source.status !== 'error' && source.status !== 'not-run') {
      evidence.retrievedAt = source.retrievedAt;
      evidence.sourceVersion = source.sourceVersion;
      evidence.contentHash = source.contentHash;
    }

    if (source.status !== 'changed') continue;

    changedSourceIds.push(source.id);
    for (const nodeId of source.affectedNodeIds) {
      const node = nextTwin.nodes.find((item) => item.id === nodeId);
      if (!node) continue;

      node.impact = 'changed';
      node.verificationStatus = 'needs-review';
      node.evidenceStatus = 'needs-evidence';
      changedNodeIds.add(nodeId);
    }
  }

  return {
    twin: nextTwin,
    changedNodeIds: [...changedNodeIds],
    changedSourceIds,
  };
}
