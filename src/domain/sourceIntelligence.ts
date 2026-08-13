import type { DigitalTwin, SemanticSupport } from './types';

export type SourceRunStatus = 'not-run' | 'first-snapshot' | 'unchanged' | 'changed' | 'refresh-blocked' | 'error';

export interface MatchedSourceClaim {
  claimId: string;
  label: string;
  value?: string;
  passage: string;
  matchType: 'deterministic-table-row' | 'deterministic-section-anchor';
}

export interface SemanticVerificationRecord {
  claimId: string;
  claim: string;
  verdict: SemanticSupport;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  model: string;
  verifiedAt: string;
  error?: string;
}

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
  observedUrl?: string;
  retrievalMode?: 'html' | 'official-pdf-fallback' | 'manual-official-file';
  contentType?: string;
  localFileName?: string;
  provenanceNote?: string;
  primaryFetchError?: string;
  extractionError?: string;
  matchedClaims?: MatchedSourceClaim[];
  semanticSupport?: SemanticSupport;
  semanticVerifications?: SemanticVerificationRecord[];
  semanticVerifierModel?: string;
  semanticVerifiedAt?: string;
  semanticVerifiedContentHash?: string;
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
  semanticVerification?: {
    model: string;
    attemptedClaims: number;
    completedClaims: number;
    generatedAt: string;
  };
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

      const matchedClaims = source.matchedClaims ?? [];
      if (matchedClaims.length > 0) {
        evidence.matchStatus = 'matched';
        evidence.passage = matchedClaims
          .map((claim) => `${claim.label}${claim.value ? ` (${claim.value})` : ''}: ${claim.passage}`)
          .join('\n\n');
      }

      const semanticMatchesCurrentSnapshot = Boolean(
        source.semanticSupport &&
          source.semanticVerifiedContentHash &&
          source.contentHash &&
          source.semanticVerifiedContentHash === source.contentHash,
      );
      evidence.semanticSupport = semanticMatchesCurrentSnapshot ? source.semanticSupport! : 'not-run';
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
