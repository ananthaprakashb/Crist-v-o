function normalize(text) {
  return text
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s*[-]\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function section(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const tail = text.slice(start);
  const end = tail.search(endPattern);
  return end > 0 ? tail.slice(0, end) : tail;
}

function eb2Row(sectionText) {
  const match = sectionText.match(/\b2nd\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)/i);
  if (!match) return null;

  return {
    passage: match[0],
    allChargeability: match[1],
    china: match[2],
    india: match[3],
    mexico: match[4],
    philippines: match[5],
  };
}

function tableContext(sectionText, sectionLabel, rowPassage) {
  const header = sectionText.match(
    /Employment-based\s+All Chargeability Areas Except Those Listed\s+CHINA-mainland born\s+INDIA\s+MEXICO\s+PHILIPPINES/i,
  )?.[0];

  return [sectionLabel, header, rowPassage].filter(Boolean).join('\n');
}

export function extractVisaBulletinClaims(rawText) {
  const text = normalize(rawText);
  if (!text) return [];

  const claims = [];
  const finalActionSection = section(
    text,
    /FINAL ACTION DATES FOR EMPLOYMENT-BASED PREFERENCE CASES/i,
    /DATES FOR FILING OF EMPLOYMENT-BASED VISA APPLICATIONS/i,
  );
  const filingSection = section(
    text,
    /DATES FOR FILING OF EMPLOYMENT-BASED VISA APPLICATIONS/i,
    /VISA AVAILABILITY IN THE EMPLOYMENT-BASED FIRST PREFERENCE|VISA AVAILABILITY IN THE EMPLOYMENT-BASED SECOND PREFERENCE|FOR THE LATEST INFORMATION/i,
  );

  const finalAction = eb2Row(finalActionSection);
  if (finalAction) {
    claims.push({
      claimId: 'eb2-india-final-action',
      label: 'EB-2 India final action status',
      value: finalAction.india,
      passage: tableContext(
        finalActionSection,
        'FINAL ACTION DATES FOR EMPLOYMENT-BASED PREFERENCE CASES',
        finalAction.passage,
      ),
      matchType: 'deterministic-table-row',
    });
  }

  const filing = eb2Row(filingSection);
  if (filing) {
    claims.push({
      claimId: 'eb2-india-filing-date',
      label: 'EB-2 India date for filing',
      value: filing.india,
      passage: tableContext(
        filingSection,
        'DATES FOR FILING OF EMPLOYMENT-BASED VISA APPLICATIONS',
        filing.passage,
      ),
      matchType: 'deterministic-table-row',
    });
  }

  const warningMatch = text.match(
    /VISA AVAILABILITY IN THE EMPLOYMENT-BASED SECOND PREFERENCE \(EB-2\) CATEGORY\s+(.{80,1000}?)(?=U\.S\. GOVERNMENT EMPLOYEE SPECIAL IMMIGRANT VISAS|FOR THE LATEST INFORMATION|Department of State Publication|$)/i,
  );
  if (warningMatch) {
    claims.push({
      claimId: 'eb2-availability-warning',
      label: 'EB-2 availability warning',
      passage: warningMatch[0].slice(0, 1200),
      matchType: 'deterministic-section-anchor',
    });
  }

  return claims;
}
