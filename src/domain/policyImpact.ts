import type { DigitalTwin, VerificationStatus } from './types';
import type {
  SemanticVerificationRecord,
  SourceFeedRecord,
  SourceIntelligenceFeed,
} from './sourceIntelligence';

export type PolicyImpactMode = 'live' | 'synthetic-demo';
export type InterpretationStatus = 'verified-current' | 'verification-required';

export interface PolicyImpactNode {
  id: string;
  title: string;
  relation: 'direct-evidence' | 'declared-downstream';
  verificationStatus: VerificationStatus;
}

export interface PolicyImpactClaim {
  claimId: string;
  label: string;
  value?: string;
  verdict: SemanticVerificationRecord['verdict'] | 'not-run';
  confidence?: SemanticVerificationRecord['confidence'];
}

export interface PolicyImpactRecord {
  sourceId: string;
  title: string;
  publisher: string;
  url: string;
  mode: PolicyImpactMode;
  previousHash?: string;
  currentHash?: string;
  sourceVersion?: string;
  retrievedAt?: string;
  interpretationStatus: InterpretationStatus;
  affectedNodes: PolicyImpactNode[];
  claims: PolicyImpactClaim[];
  changeSummary: {
    added: string[];
    removed: string[];
  };
  reviewRequired: boolean;
}

const SYNTHETIC_CHANGE_NOTE = 'Synthetic demo: retained source fingerprint changed. No policy meaning is inferred from the fingerprint change alone.';

function fallbackSource(): SourceFeedRecord {
  return {
    id: 'visa-bulletin-2026-08',
    title: 'Visa Bulletin source monitor',
    publisher: 'U.S. Department of State',
    url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
    status: 'unchanged',
    retrievedAt: new Date().toISOString(),
    sourceVersion: 'Registered source · synthetic comparison baseline',
    contentHash: 'synthetic-current-snapshot',
    semanticSupport: 'not-run',
    affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
  };
}

function targetSource(feed?: SourceIntelligenceFeed | null) {
  return feed?.sources.find((source) => source.id === 'visa-bulletin-2026-08') ?? feed?.sources[0];
}

export function createSyntheticSourceChange(feed?: SourceIntelligenceFeed | null): SourceIntelligenceFeed {
  const base: SourceIntelligenceFeed = feed
    ? structuredClone(feed)
    : {
        generatedAt: new Date().toISOString(),
        persistence: 'ephemeral',
        sources: [fallbackSource()],
      };

  if (base.sources.length === 0) base.sources.push(fallbackSource());
  const target = targetSource(base) ?? base.sources[0];
  const currentHash = target.contentHash ?? 'synthetic-current-snapshot';

  target.status = 'changed';
  target.contentHash = currentHash;
  target.previousHash = `synthetic-prior-${currentHash.slice(0, 18)}`;
  target.provenanceNote = SYNTHETIC_CHANGE_NOTE;
  target.changeSummary = {
    added: ['Synthetic demo marker: a new source fingerprint was observed.'],
    removed: ['Synthetic demo marker: the prior retained fingerprint is no longer current.'],
  };

  // A changed snapshot invalidates the prior interpretation until the current
  // evidence bundle is independently verified again.
  target.semanticSupport = 'not-run';
  target.semanticVerifications = undefined;
  target.semanticVerifiedAt = undefined;
  target.semanticVerifiedContentHash = undefined;
  target.semanticVerifiedEvidenceFingerprint = undefined;

  base.changedSourceIds = [target.id];
  base.changedNodeIds = [...target.affectedNodeIds];
  base.summary = {
    sourceCount: base.sources.length,
    verifiedSourceCount: base.sources.filter((source) => source.semanticSupport === 'supported').length,
    changedSourceCount: 1,
    unresolvedSourceIds: [target.id],
  };

  return base;
}

function currentInterpretation(source: SourceFeedRecord): InterpretationStatus {
  const hashMatches = Boolean(
    source.contentHash &&
      source.semanticVerifiedContentHash &&
      source.contentHash === source.semanticVerifiedContentHash,
  );
  const fingerprintMatches = source.evidenceFingerprint
    ? Boolean(
        source.semanticVerifiedEvidenceFingerprint &&
          source.evidenceFingerprint === source.semanticVerifiedEvidenceFingerprint,
      )
    : true;

  return source.semanticSupport === 'supported' && hashMatches && fingerprintMatches
    ? 'verified-current'
    : 'verification-required';
}

function claimsFor(source: SourceFeedRecord): PolicyImpactClaim[] {
  const verdictById = new Map((source.semanticVerifications ?? []).map((item) => [item.claimId, item]));
  return (source.matchedClaims ?? []).slice(0, 6).map((claim) => {
    const verification = verdictById.get(claim.claimId);
    return {
      claimId: claim.claimId,
      label: claim.label,
      value: claim.value,
      verdict: verification?.verdict ?? 'not-run',
      confidence: verification?.confidence,
    };
  });
}

export function buildPolicyImpacts(
  twin: DigitalTwin,
  feed?: SourceIntelligenceFeed | null,
  mode: PolicyImpactMode = 'live',
): PolicyImpactRecord[] {
  if (!feed) return [];

  return feed.sources
    .filter((source) => source.status === 'changed')
    .map((source) => {
      const affectedNodes = source.affectedNodeIds.flatMap((nodeId): PolicyImpactNode[] => {
        const node = twin.nodes.find((item) => item.id === nodeId);
        if (!node) return [];
        return [{
          id: node.id,
          title: node.title,
          relation: node.evidenceIds.includes(source.id) ? 'direct-evidence' : 'declared-downstream',
          verificationStatus: node.verificationStatus,
        }];
      });
      const interpretationStatus = currentInterpretation(source);

      return {
        sourceId: source.id,
        title: source.title,
        publisher: source.publisher,
        url: source.url,
        mode,
        previousHash: source.previousHash,
        currentHash: source.contentHash,
        sourceVersion: source.sourceVersion,
        retrievedAt: source.retrievedAt,
        interpretationStatus,
        affectedNodes,
        claims: claimsFor(source),
        changeSummary: source.changeSummary ?? { added: [], removed: [] },
        reviewRequired: interpretationStatus !== 'verified-current' || affectedNodes.some((node) => node.verificationStatus !== 'verified'),
      };
    });
}
