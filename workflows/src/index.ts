import { createHash } from 'node:crypto';
import { task } from '@renderinc/sdk/workflows';
import { GoogleGenAI } from '@google/genai';
import Redis from 'ioredis';
import { extractPdfText } from '../../scripts/lib/pdfText.mjs';
import { extractVisaBulletinClaims } from '../../scripts/lib/visaBulletinClaims.mjs';
import { fingerprintClaims } from '../../scripts/lib/evidenceFingerprint.mjs';

type ClaimVerdict = 'supported' | 'contradicted' | 'uncertain' | 'not-run';
type SourceStatus = 'first-snapshot' | 'unchanged' | 'changed' | 'refresh-blocked' | 'error';

type MatchedClaim = {
  claimId: string;
  label: string;
  value?: string;
  passage: string;
  matchType: 'deterministic-table-row' | 'deterministic-section-anchor';
};

type ClaimVerification = {
  claimId: string;
  verdict: ClaimVerdict;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  method: 'deterministic-table-validation' | 'gemini-semantic';
  model: string;
  verifiedAt: string;
};

type SourceRecord = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  status: SourceStatus;
  retrievedAt?: string;
  sourceVersion?: string;
  contentHash?: string;
  previousHash?: string;
  observedUrl?: string;
  retrievalMode?: string;
  contentType?: string;
  normalizedText?: string;
  matchedClaims?: MatchedClaim[];
  evidenceFingerprint?: string;
  semanticSupport?: ClaimVerdict;
  semanticVerifications?: ClaimVerification[];
  semanticVerifierModel?: string;
  semanticVerifiedAt?: string;
  semanticVerifiedContentHash?: string;
  semanticVerifiedEvidenceFingerprint?: string;
  affectedNodeIds: string[];
  error?: string;
};

type PipelineResult = {
  generatedAt: string;
  persistence: 'render-key-value' | 'ephemeral';
  sources: SourceRecord[];
  changedSourceIds: string[];
  changedNodeIds: string[];
  summary: {
    sourceCount: number;
    verifiedSourceCount: number;
    changedSourceCount: number;
    unresolvedSourceIds: string[];
  };
};

const sources = [
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
] as const;

const REQUIRED_CLAIMS: Record<string, string[]> = {
  'visa-bulletin-2026-08': ['eb2-india-final-action', 'eb2-india-filing-date'],
};

const STATE_PREFIX = 'cristovao:source:';
const LATEST_FEED_KEY = 'cristovao:feed:latest';

function sha256(input: string | Buffer) {
  return createHash('sha256').update(input).digest('hex');
}

function decodeEntities(text: string) {
  return text
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalizeHtml(html: string) {
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

async function fetchResponse(url: string, accept: string) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'user-agent': 'Cristovao-Caregiver/0.2 (+official-source-monitor)',
      accept,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response;
}

async function connectRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const redis = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  await redis.ping();
  return redis;
}

export const loadPreviousSourceState = task(
  { name: 'loadPreviousSourceState', timeoutSeconds: 60, retry: { maxRetries: 2, waitDurationMs: 1000 } },
  async function loadPreviousSourceState(): Promise<Record<string, SourceRecord>> {
    const redis = await connectRedis();
    if (!redis) return {};
    try {
      const result: Record<string, SourceRecord> = {};
      for (const source of sources) {
        const raw = await redis.get(`${STATE_PREFIX}${source.id}`);
        if (raw) result[source.id] = JSON.parse(raw) as SourceRecord;
      }
      return result;
    } finally {
      redis.disconnect();
    }
  },
);

export const snapshotOfficialSources = task(
  { name: 'snapshotOfficialSources', timeoutSeconds: 180, retry: { maxRetries: 2, waitDurationMs: 1500 } },
  async function snapshotOfficialSources(previousById: Record<string, SourceRecord>): Promise<SourceRecord[]> {
    const output: SourceRecord[] = [];

    for (const source of sources) {
      const previous = previousById[source.id];
      try {
        let normalizedText = '';
        let hashInput: string | Buffer;
        let observedUrl: string = source.url;
        let retrievalMode = 'html';
        let contentType = 'text/html';

        try {
          const response = await fetchResponse(source.url, 'text/html,application/xhtml+xml');
          observedUrl = response.url || source.url;
          contentType = response.headers.get('content-type') ?? 'text/html';
          normalizedText = normalizeHtml(await response.text());
          if (normalizedText.length < 200) throw new Error('Fetched page was too small to snapshot safely.');
          hashInput = normalizedText;
        } catch (primaryError) {
          if (!('fallbackUrl' in source)) throw primaryError;
          try {
            const response = await fetchResponse(source.fallbackUrl, 'application/pdf');
            observedUrl = response.url || source.fallbackUrl;
            retrievalMode = 'official-pdf-fallback';
            contentType = response.headers.get('content-type') ?? 'application/pdf';
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length < 500) throw new Error('Official PDF fallback was unexpectedly small.');
            normalizedText = await extractPdfText(bytes);
            hashInput = bytes;
          } catch (fallbackError) {
            if (previous?.contentHash) {
              output.push({
                ...previous,
                status: 'refresh-blocked',
                error: `Refresh blocked; retained prior verified snapshot. ${String(primaryError)}; ${String(fallbackError)}`,
              });
              continue;
            }
            throw fallbackError;
          }
        }

        const contentHash = sha256(hashInput!);
        const changed = Boolean(previous?.contentHash && previous.contentHash !== contentHash);
        const status: SourceStatus = !previous?.contentHash ? 'first-snapshot' : changed ? 'changed' : 'unchanged';
        const matchedClaims = source.id === 'visa-bulletin-2026-08'
          ? (extractVisaBulletinClaims(normalizedText) as MatchedClaim[])
          : [];
        const evidenceFingerprint = matchedClaims.length ? fingerprintClaims(matchedClaims) : undefined;

        output.push({
          id: source.id,
          title: source.title,
          publisher: source.publisher,
          url: source.url,
          status,
          retrievedAt: new Date().toISOString(),
          sourceVersion: 'versionHint' in source ? source.versionHint : `sha256:${contentHash.slice(0, 12)}`,
          contentHash,
          previousHash: previous?.contentHash,
          observedUrl,
          retrievalMode,
          contentType,
          normalizedText: normalizedText.slice(0, 250_000),
          matchedClaims,
          evidenceFingerprint,
          semanticSupport: changed ? 'not-run' : previous?.semanticSupport ?? 'not-run',
          semanticVerifications: changed ? undefined : previous?.semanticVerifications,
          semanticVerifierModel: changed ? undefined : previous?.semanticVerifierModel,
          semanticVerifiedAt: changed ? undefined : previous?.semanticVerifiedAt,
          semanticVerifiedContentHash: changed ? undefined : previous?.semanticVerifiedContentHash,
          semanticVerifiedEvidenceFingerprint: changed ? undefined : previous?.semanticVerifiedEvidenceFingerprint,
          affectedNodeIds: [...source.affectedNodeIds],
        });
      } catch (error) {
        output.push({
          id: source.id,
          title: source.title,
          publisher: source.publisher,
          url: source.url,
          status: 'error',
          affectedNodeIds: [...source.affectedNodeIds],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return output;
  },
);

function deterministicTableVerification(source: SourceRecord, claim: MatchedClaim): ClaimVerification {
  const headerOkay = /Employment-based\s+All Chargeability Areas Except Those Listed\s+CHINA-mainland born\s+INDIA\s+MEXICO\s+PHILIPPINES/i.test(claim.passage);
  const row = claim.passage.match(/\b2nd\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)/i);
  const parsedIndia = row?.[3];
  const supported = Boolean(headerOkay && parsedIndia && parsedIndia === claim.value);
  return {
    claimId: claim.claimId,
    verdict: supported ? 'supported' : headerOkay && parsedIndia ? 'contradicted' : 'uncertain',
    confidence: supported ? 'high' : 'low',
    rationale: supported
      ? `Deterministic table validation maps the India column to ${parsedIndia}.`
      : 'The table headers/row could not deterministically establish the extracted India value.',
    method: 'deterministic-table-validation',
    model: 'deterministic-table-validator-v1',
    verifiedAt: new Date().toISOString(),
  };
}

async function semanticVerification(source: SourceRecord, claim: MatchedClaim): Promise<ClaimVerification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      claimId: claim.claimId,
      verdict: 'not-run',
      confidence: 'low',
      rationale: 'GEMINI_API_KEY is not configured; semantic prose verification was skipped.',
      method: 'gemini-semantic',
      model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
      verifiedAt: new Date().toISOString(),
    };
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
  const ai = new GoogleGenAI({ apiKey });
  const interaction = await ai.interactions.create({
    model,
    store: false,
    input: `Classify whether the supplied official passage directly supports the claim. Use only the passage. Return supported, contradicted, or uncertain. Do not provide legal advice.\n\nCLAIM: ${claim.label}${claim.value ? ` = ${claim.value}` : ''}\n\nPASSAGE:\n${claim.passage}`,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          verdict: { type: 'string', enum: ['supported', 'contradicted', 'uncertain'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          rationale: { type: 'string' },
        },
        required: ['verdict', 'confidence', 'rationale'],
      },
    },
  });
  const parsed = JSON.parse(interaction.output_text ?? '') as { verdict: Exclude<ClaimVerdict, 'not-run'>; confidence: 'high' | 'medium' | 'low'; rationale: string };
  return {
    claimId: claim.claimId,
    verdict: parsed.verdict,
    confidence: parsed.confidence,
    rationale: parsed.rationale.slice(0, 800),
    method: 'gemini-semantic',
    model,
    verifiedAt: new Date().toISOString(),
  };
}

export const verifySourceClaims = task(
  { name: 'verifySourceClaims', timeoutSeconds: 180, retry: { maxRetries: 1, waitDurationMs: 1500 } },
  async function verifySourceClaims(records: SourceRecord[]): Promise<SourceRecord[]> {
    const verified: SourceRecord[] = [];
    for (const record of records) {
      if (record.status === 'error' || !record.matchedClaims?.length) {
        verified.push(record);
        continue;
      }

      const verdicts: ClaimVerification[] = [];
      for (const claim of record.matchedClaims) {
        verdicts.push(
          claim.matchType === 'deterministic-table-row'
            ? deterministicTableVerification(record, claim)
            : await semanticVerification(record, claim),
        );
      }

      const requiredIds = REQUIRED_CLAIMS[record.id] ?? verdicts.map((item) => item.claimId);
      const required = requiredIds.map((id) => verdicts.find((item) => item.claimId === id)).filter(Boolean) as ClaimVerification[];
      let semanticSupport: ClaimVerdict = 'not-run';
      if (required.length === requiredIds.length) {
        if (required.some((item) => item.verdict === 'contradicted')) semanticSupport = 'contradicted';
        else if (required.some((item) => item.verdict === 'uncertain')) semanticSupport = 'uncertain';
        else if (required.some((item) => item.verdict === 'not-run')) semanticSupport = 'not-run';
        else if (required.every((item) => item.verdict === 'supported')) semanticSupport = 'supported';
      }

      verified.push({
        ...record,
        semanticSupport,
        semanticVerifications: verdicts,
        semanticVerifierModel: `hybrid:${process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'}`,
        semanticVerifiedAt: new Date().toISOString(),
        semanticVerifiedContentHash: record.contentHash,
        semanticVerifiedEvidenceFingerprint: record.evidenceFingerprint,
      });
    }
    return verified;
  },
);

export const persistEvidenceState = task(
  { name: 'persistEvidenceState', timeoutSeconds: 60, retry: { maxRetries: 3, waitDurationMs: 1000 } },
  async function persistEvidenceState(records: SourceRecord[]): Promise<'render-key-value' | 'ephemeral'> {
    const redis = await connectRedis();
    if (!redis) return 'ephemeral';
    try {
      const pipeline = redis.pipeline();
      for (const record of records) pipeline.set(`${STATE_PREFIX}${record.id}`, JSON.stringify(record));
      await pipeline.exec();
      return 'render-key-value';
    } finally {
      redis.disconnect();
    }
  },
);

export const publishEvidenceFeed = task(
  { name: 'publishEvidenceFeed', timeoutSeconds: 60, retry: { maxRetries: 3, waitDurationMs: 1000 } },
  async function publishEvidenceFeed(result: PipelineResult): Promise<PipelineResult> {
    const redis = await connectRedis();
    if (!redis) return result;
    try {
      await redis.set(LATEST_FEED_KEY, JSON.stringify(result));
      return result;
    } finally {
      redis.disconnect();
    }
  },
);

export const refreshImmigrationEvidence = task(
  { name: 'refreshImmigrationEvidence', timeoutSeconds: 900, retry: { maxRetries: 1, waitDurationMs: 2000 } },
  async function refreshImmigrationEvidence(): Promise<PipelineResult> {
    const previous = await loadPreviousSourceState();
    const snapshotted = await snapshotOfficialSources(previous);
    const verified = await verifySourceClaims(snapshotted);
    const persistence = await persistEvidenceState(verified);

    const changedSourceIds = verified.filter((item) => item.status === 'changed').map((item) => item.id);
    const changedNodeIds = [...new Set(verified.filter((item) => item.status === 'changed').flatMap((item) => item.affectedNodeIds))];
    const result: PipelineResult = {
      generatedAt: new Date().toISOString(),
      persistence,
      sources: verified.map(({ normalizedText: _omitted, ...record }) => record),
      changedSourceIds,
      changedNodeIds,
      summary: {
        sourceCount: verified.length,
        verifiedSourceCount: verified.filter((item) => item.semanticSupport === 'supported').length,
        changedSourceCount: changedSourceIds.length,
        unresolvedSourceIds: verified.filter((item) => item.status === 'error' || item.semanticSupport === 'contradicted' || item.semanticSupport === 'uncertain').map((item) => item.id),
      },
    };

    return publishEvidenceFeed(result);
  },
);

export const getLatestEvidenceFeed = task(
  { name: 'getLatestEvidenceFeed', timeoutSeconds: 60 },
  async function getLatestEvidenceFeed(): Promise<PipelineResult | null> {
    const redis = await connectRedis();
    if (!redis) return null;
    try {
      const raw = await redis.get(LATEST_FEED_KEY);
      return raw ? (JSON.parse(raw) as PipelineResult) : null;
    } finally {
      redis.disconnect();
    }
  },
);
