import { describe, expect, it } from 'vitest';
import { compileJourney } from './journeyCompiler';
import { applySourceIntelligence, type SourceIntelligenceFeed } from './sourceIntelligence';
import { buildPolicyImpacts, createSyntheticSourceChange } from './policyImpact';

const FEED: SourceIntelligenceFeed = {
  generatedAt: '2026-08-13T16:00:00.000Z',
  persistence: 'render-key-value',
  sources: [
    {
      id: 'visa-bulletin-2026-08',
      title: 'Registered official source',
      publisher: 'Official publisher',
      url: 'https://travel.state.gov/example',
      status: 'unchanged',
      retrievedAt: '2026-08-13T16:00:00.000Z',
      sourceVersion: 'Current version',
      contentHash: 'current-hash-123',
      evidenceFingerprint: 'claims-123',
      semanticSupport: 'supported',
      semanticVerifiedContentHash: 'current-hash-123',
      semanticVerifiedEvidenceFingerprint: 'claims-123',
      matchedClaims: [
        {
          claimId: 'demo-claim',
          label: 'Retained claim',
          value: 'DEMO',
          passage: 'Synthetic test passage.',
          matchType: 'deterministic-table-row',
        },
      ],
      semanticVerifications: [
        {
          claimId: 'demo-claim',
          verdict: 'supported',
          confidence: 'high',
          rationale: 'Synthetic test verification.',
          model: 'test',
          verifiedAt: '2026-08-13T16:00:00.000Z',
        },
      ],
      affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
    },
  ],
};

describe('source impact experience', () => {
  it('invalidates only declared graph nodes after a snapshot change', () => {
    const twin = compileJourney('H-1B employment-based process');
    const simulated = createSyntheticSourceChange(FEED);
    const result = applySourceIntelligence(twin, simulated);

    expect(simulated.sources[0].status).toBe('changed');
    expect(simulated.sources[0].semanticSupport).toBe('not-run');
    expect(result.changedNodeIds.sort()).toEqual([
      'authoritative-evidence',
      'next-milestone',
      'priority-monitoring',
    ]);
    expect(result.twin.nodes.find((node) => node.id === 'current-profile')?.impact).toBe('unchanged');
  });

  it('requires verification before treating changed evidence as current', () => {
    const twin = compileJourney('H-1B employment-based process');
    const simulated = createSyntheticSourceChange(FEED);
    const sourceImpact = applySourceIntelligence(twin, simulated);
    const impacts = buildPolicyImpacts(sourceImpact.twin, simulated, 'synthetic-demo');

    expect(impacts).toHaveLength(1);
    expect(impacts[0].mode).toBe('synthetic-demo');
    expect(impacts[0].interpretationStatus).toBe('verification-required');
    expect(impacts[0].reviewRequired).toBe(true);
    expect(impacts[0].affectedNodes.map((node) => node.id).sort()).toEqual([
      'authoritative-evidence',
      'next-milestone',
      'priority-monitoring',
    ]);
  });
});
