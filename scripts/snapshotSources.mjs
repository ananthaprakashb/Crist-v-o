import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractPdfText } from './lib/pdfText.mjs';
import { extractVisaBulletinClaims } from './lib/visaBulletinClaims.mjs';
import { fingerprintClaims } from './lib/evidenceFingerprint.mjs';

const registry = [
  {
    id: 'uscis-policy-manual',
    title: 'USCIS Policy Manual',
    publisher: 'U.S. Citizenship and Immigration Services',
    url: 'https://www.uscis.gov/policy-manual',
    affectedNodeIds: ['authoritative-evidence', 'employer-branch', 'dependent-milestone', 'next-milestone'],
  },
  {
    id: 'visa-bulletin-2026-08',
    title: 'Visa Bulletin for August 2026',
    publisher: 'U.S. Department of State',
    url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
    fallbackUrl: 'https://travel.state.gov/content/dam/visas/Bulletins/visabulletin_August2026.pdf',
    versionHint: 'August 2026',
    affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
  },
];

const stateDir = process.env.SOURCE_STATE_DIR ?? path.resolve('data/source-snapshots');
const feedPath = process.env.SOURCE_FEED_PATH ?? path.resolve('public/source-intelligence.json');

function decodeEntities(text) {
  return text
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalizeHtml(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  return decodeEntities(
    main
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function versionFor(source, text, contentHash) {
  if (source.versionHint) return source.versionHint;
  if (source.id.startsWith('visa-bulletin-')) {
    const match = text.match(/Visa Bulletin(?: For| for)?\s+([A-Za-z]+)\s+(\d{4})/i);
    if (match) return `${match[1]} ${match[2]}`;
  }
  return `sha256:${contentHash.slice(0, 12)}`;
}

function matchedClaimsFor(source, text) {
  if (!text) return [];
  if (source.id.startsWith('visa-bulletin-')) return extractVisaBulletinClaims(text);
  return [];
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40 && part.length <= 500);
}

function diffSummary(previousText = '', currentText = '') {
  if (!previousText || !currentText) return { added: [], removed: [] };
  const before = new Set(sentences(previousText));
  const after = new Set(sentences(currentText));
  return {
    added: [...after].filter((item) => !before.has(item)).slice(0, 4),
    removed: [...before].filter((item) => !after.has(item)).slice(0, 4),
  };
}

async function readPrevious(id) {
  try {
    return JSON.parse(await readFile(path.join(stateDir, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function semanticStateFor(previous, contentHash, evidenceFingerprint, changed) {
  const valid = Boolean(
    !changed &&
      evidenceFingerprint &&
      previous?.semanticVerifiedContentHash === contentHash &&
      previous?.semanticVerifiedEvidenceFingerprint === evidenceFingerprint,
  );

  return valid
    ? {
        semanticSupport: previous.semanticSupport ?? 'not-run',
        semanticVerifications: previous.semanticVerifications,
        semanticVerifierModel: previous.semanticVerifierModel,
        semanticVerifiedAt: previous.semanticVerifiedAt,
        semanticVerifiedContentHash: previous.semanticVerifiedContentHash,
        semanticVerifiedEvidenceFingerprint: previous.semanticVerifiedEvidenceFingerprint,
      }
    : {
        semanticSupport: 'not-run',
        semanticVerifications: undefined,
        semanticVerifierModel: undefined,
        semanticVerifiedAt: undefined,
        semanticVerifiedContentHash: undefined,
        semanticVerifiedEvidenceFingerprint: undefined,
      };
}

async function fetchResponse(url, accept) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: {
      'user-agent': 'Cristovao-Caregiver-Hackathon/0.1 (+source provenance monitor)',
      accept,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response;
}

async function fetchOfficialSource(source) {
  try {
    const response = await fetchResponse(source.url, 'text/html,application/xhtml+xml');
    const text = normalizeHtml(await response.text());
    if (text.length < 200) throw new Error('Fetched page did not contain enough normalized text to snapshot safely.');

    return {
      observedUrl: response.url || source.url,
      retrievalMode: 'html',
      contentType: response.headers.get('content-type') ?? 'text/html',
      normalizedText: text,
      hashInput: text,
    };
  } catch (primaryError) {
    if (!source.fallbackUrl) throw primaryError;

    try {
      const response = await fetchResponse(source.fallbackUrl, 'application/pdf');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 500) throw new Error('Official PDF fallback was unexpectedly small.');

      let normalizedText = '';
      let extractionError;
      try {
        normalizedText = await extractPdfText(bytes);
      } catch (error) {
        extractionError = error instanceof Error ? error.message : String(error);
      }

      return {
        observedUrl: response.url || source.fallbackUrl,
        retrievalMode: 'official-pdf-fallback',
        contentType: response.headers.get('content-type') ?? 'application/pdf',
        normalizedText,
        hashInput: bytes,
        primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
        extractionError,
      };
    } catch (fallbackError) {
      const primary = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`HTML fetch blocked (${primary}); official PDF fetch also blocked (${fallback}).`);
    }
  }
}

async function snapshot(source) {
  const previous = await readPrevious(source.id);
  try {
    const fetched = await fetchOfficialSource(source);
    const contentHash = hash(fetched.hashInput);
    const retrievedAt = new Date().toISOString();
    const changed = Boolean(previous?.contentHash && previous.contentHash !== contentHash);
    const status = !previous?.contentHash ? 'first-snapshot' : changed ? 'changed' : 'unchanged';
    const sourceVersion = versionFor(source, fetched.normalizedText, contentHash);
    const matchedClaims = matchedClaimsFor(source, fetched.normalizedText);
    const evidenceFingerprint = fingerprintClaims(matchedClaims);
    const semanticState = semanticStateFor(previous, contentHash, evidenceFingerprint, changed);
    const state = {
      id: source.id,
      retrievedAt,
      sourceVersion,
      contentHash,
      observedUrl: fetched.observedUrl,
      retrievalMode: fetched.retrievalMode,
      contentType: fetched.contentType,
      normalizedText: fetched.normalizedText ? fetched.normalizedText.slice(0, 250000) : undefined,
      matchedClaims,
      evidenceFingerprint,
      extractionError: fetched.extractionError,
      ...semanticState,
    };

    await writeFile(path.join(stateDir, `${source.id}.json`), JSON.stringify(state, null, 2));

    return {
      ...source,
      status,
      retrievedAt,
      sourceVersion,
      contentHash,
      previousHash: previous?.contentHash,
      observedUrl: fetched.observedUrl,
      retrievalMode: fetched.retrievalMode,
      contentType: fetched.contentType,
      primaryFetchError: fetched.primaryError,
      extractionError: fetched.extractionError,
      matchedClaims,
      evidenceFingerprint,
      ...semanticState,
      affectedNodeIds: source.affectedNodeIds,
      changeSummary: changed ? diffSummary(previous?.normalizedText, fetched.normalizedText) : { added: [], removed: [] },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (previous?.contentHash) {
      const evidenceFingerprint = previous.evidenceFingerprint ?? fingerprintClaims(previous.matchedClaims ?? []);
      const semanticState = semanticStateFor(previous, previous.contentHash, evidenceFingerprint, false);
      return {
        ...source,
        status: 'refresh-blocked',
        retrievedAt: previous.retrievedAt,
        sourceVersion: previous.sourceVersion,
        contentHash: previous.contentHash,
        observedUrl: previous.observedUrl,
        retrievalMode: previous.retrievalMode,
        contentType: previous.contentType,
        localFileName: previous.localFileName,
        provenanceNote: previous.provenanceNote,
        matchedClaims: previous.matchedClaims ?? [],
        evidenceFingerprint,
        extractionError: previous.extractionError,
        ...semanticState,
        affectedNodeIds: source.affectedNodeIds,
        error: `Refresh attempt blocked; retaining last known snapshot. ${message}`,
      };
    }

    return {
      ...source,
      status: 'error',
      semanticSupport: 'not-run',
      affectedNodeIds: source.affectedNodeIds,
      error: `${message} Download the official bulletin in a browser and import it with npm run sources:import -- ${source.id} "<path-to-file>".`,
    };
  }
}

await mkdir(stateDir, { recursive: true });
await mkdir(path.dirname(feedPath), { recursive: true });

const sources = [];
for (const source of registry) sources.push(await snapshot(source));

const feed = { generatedAt: new Date().toISOString(), sources };
await writeFile(feedPath, JSON.stringify(feed, null, 2));

for (const source of sources) {
  if (source.status === 'error' || source.status === 'refresh-blocked') {
    console.log(`${source.id}: ${source.status}: ${source.error}`);
    continue;
  }

  const mode = source.retrievalMode === 'official-pdf-fallback' ? ' (official PDF fallback)' : '';
  const matches = source.matchedClaims?.length ? ` · ${source.matchedClaims.length} evidence passages matched` : '';
  const semantic = source.semanticSupport && source.semanticSupport !== 'not-run' ? ` · semantic ${source.semanticSupport}` : '';
  const extraction = source.extractionError ? ` · extraction warning: ${source.extractionError}` : '';
  console.log(`${source.id}: ${source.status} ${source.sourceVersion ?? ''}${mode}${matches}${semantic}${extraction}`);
}
