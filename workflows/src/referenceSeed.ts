import { createHash } from 'node:crypto';
import { extractVisaBulletinClaims } from '../../scripts/lib/visaBulletinClaims.mjs';
import { fingerprintClaims } from '../../scripts/lib/evidenceFingerprint.mjs';

const AUGUST_2026_EMPLOYMENT_EXCERPT = `
FINAL ACTION DATES FOR EMPLOYMENT-BASED PREFERENCE CASES
Employment-based All Chargeability Areas Except Those Listed CHINA-mainland born INDIA MEXICO PHILIPPINES
2nd C 01SEP21 U C C

DATES FOR FILING OF EMPLOYMENT-BASED VISA APPLICATIONS
Employment-based All Chargeability Areas Except Those Listed CHINA-mainland born INDIA MEXICO PHILIPPINES
2nd C 01JAN22 15JAN15 C C

FOR THE LATEST INFORMATION
`.trim();

export function referenceSeedFor(sourceId: string) {
  if (sourceId !== 'visa-bulletin-2026-08') return null;

  const matchedClaims = extractVisaBulletinClaims(AUGUST_2026_EMPLOYMENT_EXCERPT).map((claim: any) => ({
    ...claim,
    claimId: `reference-${claim.claimId}`,
  }));
  return {
    id: sourceId,
    title: 'Visa Bulletin for August 2026',
    publisher: 'U.S. Department of State',
    url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
    status: 'refresh-blocked' as const,
    retrievedAt: '2026-08-14T02:35:00.000Z',
    sourceVersion: 'August 2026',
    contentHash: createHash('sha256').update(AUGUST_2026_EMPLOYMENT_EXCERPT).digest('hex'),
    observedUrl: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
    retrievalMode: 'official-reference-seed',
    contentType: 'text/plain; retained-official-excerpt',
    normalizedText: AUGUST_2026_EMPLOYMENT_EXCERPT,
    matchedClaims,
    evidenceFingerprint: fingerprintClaims(matchedClaims),
    semanticSupport: 'not-run' as const,
    affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
    provenanceNote: 'Retained excerpt from the official August 2026 Department of State Visa Bulletin. Used only when automated cloud refresh is blocked; currentness must be re-verified after a successful refresh.',
  };
}
