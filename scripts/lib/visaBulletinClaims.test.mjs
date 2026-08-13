import { describe, expect, it } from 'vitest';
import { extractVisaBulletinClaims } from './visaBulletinClaims.mjs';

const fixture = `
A. FINAL ACTION DATES FOR EMPLOYMENT-BASED PREFERENCE CASES
Employment-based All Chargeability Areas Except Those Listed CHINA-mainland born INDIA MEXICO PHILIPPINES
1st C 01JUL23 15OCT22 C C
2nd C 01SEP21 U C C
3rd 01SEP24 01JAN22 01JAN14 01SEP24 01AUG23

B. DATES FOR FILING OF EMPLOYMENT-BASED VISA APPLICATIONS
Employment-based All Chargeability Areas Except Those Listed CHINA-mainland born INDIA MEXICO PHILIPPINES
1st C 01DEC23 01DEC23 C C
2nd C 01JAN22 15JAN15 C C
3rd C 08JAN22 15JAN15 C 01JAN24

F. VISA AVAILABILITY IN THE EMPLOYMENT-BASED SECOND PREFERENCE (EB-2) CATEGORY
Sufficient demand and increased number use in the EB-2 visa category may make it necessary to retrogress the final action date or make the category unavailable in the coming months to hold number use within the maximum allowed under the FY 2026 annual limit. This situation will be continually monitored, and any necessary adjustments will be made accordingly.
G. U.S. GOVERNMENT EMPLOYEE SPECIAL IMMIGRANT VISAS (SIVs)
`;

describe('Visa Bulletin claim extraction', () => {
  it('extracts EB-2 India final action, filing, and availability warning evidence', () => {
    const claims = extractVisaBulletinClaims(fixture);

    expect(claims.find((claim) => claim.claimId === 'eb2-india-final-action')?.value).toBe('U');
    expect(claims.find((claim) => claim.claimId === 'eb2-india-filing-date')?.value).toBe('15JAN15');
    expect(claims.find((claim) => claim.claimId === 'eb2-availability-warning')?.passage).toContain('retrogress');
  });
});
