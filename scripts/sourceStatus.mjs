import { readFile } from 'node:fs/promises';
import path from 'node:path';

const feedPath = process.env.SOURCE_FEED_PATH ?? path.resolve('public/source-intelligence.json');
const [, , requestedId = 'visa-bulletin-2026-08'] = process.argv;

const feed = JSON.parse(await readFile(feedPath, 'utf8'));
const source = (feed.sources ?? []).find((item) => item.id === requestedId);

if (!source) {
  console.error(`Source not found in ${feedPath}: ${requestedId}`);
  process.exit(1);
}

console.log(`Source: ${source.id}`);
console.log(`Status: ${source.status}`);
console.log(`Version: ${source.sourceVersion ?? '—'}`);
console.log(`Content hash: ${source.contentHash ?? '—'}`);
console.log(`Evidence fingerprint: ${source.evidenceFingerprint ?? '—'}`);
console.log(`Independent verification: ${source.semanticSupport ?? 'not-run'}`);
console.log(`Verified content hash: ${source.semanticVerifiedContentHash ?? '—'}`);
console.log(`Verified evidence fingerprint: ${source.semanticVerifiedEvidenceFingerprint ?? '—'}`);
console.log(`Current evidence matches verified evidence: ${Boolean(
  source.contentHash &&
    source.evidenceFingerprint &&
    source.contentHash === source.semanticVerifiedContentHash &&
    source.evidenceFingerprint === source.semanticVerifiedEvidenceFingerprint,
) ? 'YES' : 'NO'}`);

for (const result of source.semanticVerifications ?? []) {
  console.log(`- ${result.claimId}: ${result.verdict} (${result.confidence}) [${result.method ?? result.model ?? 'unknown'}]`);
  if (result.rationale) console.log(`  ${result.rationale}`);
  if (result.error) console.log(`  ERROR: ${result.error}`);
}
