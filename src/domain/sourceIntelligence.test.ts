import { describe, expect, it } from 'vitest';
import { compileJourney } from './journeyCompiler';
import { applySourceIntelligence, type SourceIntelligenceFeed } from './sourceIntelligence';

const syntheticCase = `I am on H-1B. My spouse and child are dependents. My employer started an employment-based green card process.`;

function feed(
  status: 'first-snapshot' | 'changed',
  semanticSupport?: 'supported' | 'contradicted' | 'uncertain' | 'not-run',
  semanticHash = 'abc123',
): SourceIntelligenceFeed {
  return {
    generatedAt: '2026-08-13T06:30:00.000Z',
    sources: [
      {
        id: 'visa-bulletin-2026-08',
        title: 'Visa Bulletin for August 2026',
        publisher: 'U.S. Department of State',
        url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
        status,
        retrievedAt: '2026-08-13T06:30:00.000Z',
        sourceVersion: 'August 2026',
        contentHash: 'abc123',
        previousHash: status === 'changed' ? 'old123' : undefined,
        matchedClaims: [
          {
            claimId: 'eb2-india-final-action',
            label: 'EB-2 India final action status',
            value: 'U',
            passage: '2nd C 01SEP21 U C C',
            matchType: 'deterministic-table-row',
          },
        ],
        semanticSupport,
        semanticVerifiedContentHash: semanticSupport && semanticSupport !== 'not-run' ? semanticHash : undefined,
        semanticVerifications: semanticSupport && semanticSupport !== 'not-run'
          ? [
              {
                claimId: 'eb2-india-final-action',
                claim: 'In the August 2026 Visa Bulletin Final Action Dates table, the EB-2 India value is U.',
                verdict: semanticSupport,
                confidence: 'high',
                rationale: 'Synthetic verifier result for domain integration testing.',
                model: 'test-verifier',
                verifiedAt: '2026-08-13T06:31:00.000Z',
              },
            ]
          : undefined,
        affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
      },
    ],
  };
}

describe('Source Intelligence', () => {
  it('adds snapshot provenance and matched passages without pretending semantic verification ran', () => {
    const twin = compileJourney(syntheticCase);
    const result = applySourceIntelligence(twin, feed('first-snapshot'));
    const evidence = result.twin.evidence.find((item) => item.id === 'visa-bulletin-2026-08');

    expect(evidence?.sourceVersion).toBe('August 2026');
    expect(evidence?.contentHash).toBe('abc123');
    expect(evidence?.matchStatus).toBe('matched');
    expect(evidence?.passage).toContain('EB-2 India final action status (U)');
    expect(evidence?.semanticSupport).toBe('not-run');
    expect(result.changedNodeIds).toEqual([]);
  });

  it('applies an independent semantic verdict only when it belongs to the current content hash', () => {
    const twin = compileJourney(syntheticCase);
    const result = applySourceIntelligence(twin, feed('first-snapshot', 'supported'));
    const evidence = result.twin.evidence.find((item) => item.id === 'visa-bulletin-2026-08');

    expect(evidence?.matchStatus).toBe('matched');
    expect(evidence?.semanticSupport).toBe('supported');
  });

  it('invalidates a stale semantic verdict when its verified hash differs from the current source hash', () => {
    const twin = compileJourney(syntheticCase);
    const result = applySourceIntelligence(twin, feed('first-snapshot', 'supported', 'stale-hash'));
    const evidence = result.twin.evidence.find((item) => item.id === 'visa-bulletin-2026-08');

    expect(evidence?.semanticSupport).toBe('not-run');
  });

  it('propagates a changed source only to declared dependent nodes', () => {
    const twin = compileJourney(syntheticCase);
    const result = applySourceIntelligence(twin, feed('changed'));

    expect(result.changedSourceIds).toEqual(['visa-bulletin-2026-08']);
    expect(result.changedNodeIds).toEqual(['authoritative-evidence', 'priority-monitoring', 'next-milestone']);
    expect(result.twin.nodes.find((node) => node.id === 'priority-monitoring')?.impact).toBe('changed');
    expect(result.twin.nodes.find((node) => node.id === 'document-readiness')?.impact).toBe('unchanged');
  });
});
