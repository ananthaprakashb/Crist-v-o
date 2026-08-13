import { describe, expect, it } from 'vitest';
import type { SourceIntelligenceFeed } from '../../src/domain/sourceIntelligence';

describe('live evidence feed contract', () => {
  it('accepts the workflow result shape consumed by the React source-intelligence layer', () => {
    const feed: SourceIntelligenceFeed = {
      generatedAt: '2026-08-13T08:00:00.000Z',
      persistence: 'render-key-value',
      changedSourceIds: ['visa-bulletin-2026-08'],
      changedNodeIds: ['priority-monitoring'],
      summary: {
        sourceCount: 1,
        verifiedSourceCount: 1,
        changedSourceCount: 1,
        unresolvedSourceIds: [],
      },
      sources: [
        {
          id: 'visa-bulletin-2026-08',
          title: 'Visa Bulletin for August 2026',
          publisher: 'U.S. Department of State',
          url: 'https://travel.state.gov/example',
          status: 'changed',
          semanticSupport: 'supported',
          affectedNodeIds: ['priority-monitoring'],
        },
      ],
    };

    expect(feed.persistence).toBe('render-key-value');
    expect(feed.sources[0]?.semanticSupport).toBe('supported');
    expect(feed.changedNodeIds).toEqual(['priority-monitoring']);
  });
});
