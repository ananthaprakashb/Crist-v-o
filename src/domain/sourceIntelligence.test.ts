import { describe, expect, it } from 'vitest';
import { compileJourney } from './journeyCompiler';
import { applySourceIntelligence, type SourceIntelligenceFeed } from './sourceIntelligence';

const syntheticCase = `I am on H-1B. My spouse and child are dependents. My employer started an employment-based green card process.`;

function feed(status: 'first-snapshot' | 'changed'): SourceIntelligenceFeed {
  return {
    generatedAt: '2026-08-13T06:30:00.000Z',
    sources: [
      {
        id: 'visa-bulletin',
        title: 'Visa Bulletin',
        publisher: 'U.S. Department of State',
        url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html',
        status,
        retrievedAt: '2026-08-13T06:30:00.000Z',
        sourceVersion: 'August 2026',
        contentHash: 'abc123',
        previousHash: status === 'changed' ? 'old123' : undefined,
        affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
      },
    ],
  };
}

describe('Source Intelligence', () => {
  it('adds snapshot provenance without pretending a first snapshot is a policy change', () => {
    const twin = compileJourney(syntheticCase);
    const result = applySourceIntelligence(twin, feed('first-snapshot'));
    const evidence = result.twin.evidence.find((item) => item.id === 'visa-bulletin');

    expect(evidence?.sourceVersion).toBe('August 2026');
    expect(evidence?.contentHash).toBe('abc123');
    expect(result.changedNodeIds).toEqual([]);
  });

  it('propagates a changed source only to declared dependent nodes', () => {
    const twin = compileJourney(syntheticCase);
    const result = applySourceIntelligence(twin, feed('changed'));

    expect(result.changedSourceIds).toEqual(['visa-bulletin']);
    expect(result.changedNodeIds).toEqual(['authoritative-evidence', 'priority-monitoring', 'next-milestone']);
    expect(result.twin.nodes.find((node) => node.id === 'priority-monitoring')?.impact).toBe('changed');
    expect(result.twin.nodes.find((node) => node.id === 'document-readiness')?.impact).toBe('unchanged');
  });
});
