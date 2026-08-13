import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { fingerprintClaims } from './lib/evidenceFingerprint.mjs';

const feedPath = process.env.SOURCE_FEED_PATH ?? path.resolve('public/source-intelligence.json');
const stateDir = process.env.SOURCE_STATE_DIR ?? path.resolve('data/source-snapshots');
const model = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
const apiKey = process.env.GEMINI_API_KEY;

const REQUIRED_CLAIMS = {
  'visa-bulletin-2026-08': ['eb2-india-final-action', 'eb2-india-filing-date'],
};

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const verdictSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: {
      type: 'string',
      enum: ['supported', 'contradicted', 'uncertain'],
      description: 'Whether the supplied passage supports, contradicts, or is insufficient to establish the supplied claim.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
    },
    rationale: {
      type: 'string',
      description: 'A short explanation based only on the supplied passage. Do not add outside facts or legal advice.',
    },
  },
  required: ['verdict', 'confidence', 'rationale'],
};

function claimStatement(source, claim) {
  if (claim.claimId === 'eb2-india-final-action') {
    return `In the ${source.sourceVersion ?? 'observed'} Visa Bulletin Final Action Dates for Employment-Based Preference Cases, the EB-2 India value is ${claim.value}.`;
  }

  if (claim.claimId === 'eb2-india-filing-date') {
    return `In the ${source.sourceVersion ?? 'observed'} Visa Bulletin Dates for Filing of Employment-Based Visa Applications, the EB-2 India value is ${claim.value}.`;
  }

  if (claim.claimId === 'eb2-availability-warning') {
    return `The ${source.sourceVersion ?? 'observed'} Visa Bulletin contains an EB-2 visa-availability warning that may affect future availability.`;
  }

  return claim.value ? `${claim.label}: ${claim.value}` : claim.label;
}

function validateVerdict(value) {
  if (!value || !['supported', 'contradicted', 'uncertain'].includes(value.verdict)) {
    throw new Error('Verifier returned an invalid verdict.');
  }
  if (!['high', 'medium', 'low'].includes(value.confidence)) {
    throw new Error('Verifier returned an invalid confidence value.');
  }
  if (typeof value.rationale !== 'string' || value.rationale.trim().length === 0) {
    throw new Error('Verifier returned an empty rationale.');
  }
  return value;
}

function verifyTableClaim(source, claim) {
  const claimText = claimStatement(source, claim);
  const headerHasIndia = /Employment-based\s+All Chargeability Areas Except Those Listed\s+CHINA-mainland born\s+INDIA\s+MEXICO\s+PHILIPPINES/i.test(claim.passage);
  const row = claim.passage.match(/\b2nd\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)\s+([A-Z0-9]+)/i);

  if (!headerHasIndia || !row) {
    return {
      claimId: claim.claimId,
      claim: claimText,
      verdict: 'uncertain',
      confidence: 'low',
      rationale: 'The deterministic validator could not preserve both the Visa Bulletin column headers and the EB-2 row.',
      model: 'deterministic-table-validator-v1',
      method: 'deterministic-table-validation',
      verifiedAt: new Date().toISOString(),
    };
  }

  const parsedIndia = row[3];
  const verdict = parsedIndia === claim.value ? 'supported' : 'contradicted';
  return {
    claimId: claim.claimId,
    claim: claimText,
    verdict,
    confidence: 'high',
    rationale:
      verdict === 'supported'
        ? `The source headers place INDIA in the third country-specific column, and the EB-2 row value in that position is ${parsedIndia}.`
        : `The source row maps INDIA to ${parsedIndia}, which conflicts with the extracted claim value ${claim.value}.`,
    model: 'deterministic-table-validator-v1',
    method: 'deterministic-table-validation',
    verifiedAt: new Date().toISOString(),
  };
}

async function verifySemanticClaim(source, claim) {
  if (!ai) {
    return {
      claimId: claim.claimId,
      claim: claimStatement(source, claim),
      verdict: 'not-run',
      confidence: 'low',
      rationale: 'Gemini semantic verification was not run because GEMINI_API_KEY is not set.',
      model,
      method: 'gemini-semantic',
      verifiedAt: new Date().toISOString(),
      error: 'GEMINI_API_KEY is not set.',
    };
  }

  const claimText = claimStatement(source, claim);
  const prompt = `You are an independent evidence verifier in a high-impact immigration information system.\n\nYour task is narrow: decide whether the EVIDENCE PASSAGE supports the CLAIM.\n\nRules:\n- Use only the supplied passage.\n- Do not use outside knowledge.\n- Do not infer legal eligibility, approval likelihood, or advice.\n- "supported" means the passage directly establishes the claim.\n- "contradicted" means the passage directly conflicts with the claim.\n- "uncertain" means the passage is ambiguous, incomplete, or does not establish the claim.\n\nCLAIM:\n${claimText}\n\nEVIDENCE PASSAGE:\n${claim.passage}`;

  const interaction = await ai.interactions.create({
    model,
    input: prompt,
    store: false,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: verdictSchema,
    },
  });

  const parsed = validateVerdict(JSON.parse(interaction.output_text));
  return {
    claimId: claim.claimId,
    claim: claimText,
    verdict: parsed.verdict,
    confidence: parsed.confidence,
    rationale: parsed.rationale.trim().slice(0, 800),
    model,
    method: 'gemini-semantic',
    verifiedAt: new Date().toISOString(),
  };
}

async function verifyClaim(source, claim) {
  if (claim.matchType === 'deterministic-table-row') return verifyTableClaim(source, claim);
  return verifySemanticClaim(source, claim);
}

function aggregate(sourceId, verifications) {
  const requiredIds = REQUIRED_CLAIMS[sourceId] ?? verifications.map((item) => item.claimId);
  const required = requiredIds.map((id) => verifications.find((item) => item.claimId === id)).filter(Boolean);
  if (required.length !== requiredIds.length) return 'not-run';
  if (required.some((item) => item.verdict === 'contradicted')) return 'contradicted';
  if (required.some((item) => item.verdict === 'uncertain')) return 'uncertain';
  if (required.some((item) => item.verdict === 'not-run')) return 'not-run';
  return required.every((item) => item.verdict === 'supported') ? 'supported' : 'not-run';
}

async function persistSourceState(source) {
  if (!source.contentHash || !source.evidenceFingerprint) return;
  const statePath = path.join(stateDir, `${source.id}.json`);
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    if (state.contentHash !== source.contentHash || state.evidenceFingerprint !== source.evidenceFingerprint) {
      console.log(`${source.id}: verification verdict not persisted because source/evidence changed during verification.`);
      return;
    }

    state.semanticVerifications = source.semanticVerifications;
    state.semanticSupport = source.semanticSupport;
    state.semanticVerifierModel = source.semanticVerifierModel;
    state.semanticVerifiedAt = source.semanticVerifiedAt;
    state.semanticVerifiedContentHash = source.contentHash;
    state.semanticVerifiedEvidenceFingerprint = source.evidenceFingerprint;
    await writeFile(statePath, JSON.stringify(state, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${source.id}: could not persist verification verdict to snapshot state: ${message}`);
  }
}

const feed = JSON.parse(await readFile(feedPath, 'utf8'));
let attempted = 0;
let completed = 0;

for (const source of feed.sources ?? []) {
  const claims = source.matchedClaims ?? [];
  if (claims.length === 0) continue;

  source.evidenceFingerprint = source.evidenceFingerprint ?? fingerprintClaims(claims);
  const semanticVerifications = [];
  for (const claim of claims) {
    attempted += 1;
    try {
      const result = await verifyClaim(source, claim);
      semanticVerifications.push(result);
      if (result.verdict !== 'not-run') completed += 1;
      console.log(`${source.id}/${claim.claimId}: ${result.verdict} (${result.confidence}) [${result.method}]`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      semanticVerifications.push({
        claimId: claim.claimId,
        claim: claimStatement(source, claim),
        verdict: 'not-run',
        confidence: 'low',
        rationale: 'Independent verification did not complete.',
        model,
        method: claim.matchType === 'deterministic-table-row' ? 'deterministic-table-validation' : 'gemini-semantic',
        verifiedAt: new Date().toISOString(),
        error: message,
      });
      console.log(`${source.id}/${claim.claimId}: verifier error: ${message}`);
    }
  }

  source.semanticVerifications = semanticVerifications;
  source.semanticSupport = aggregate(source.id, semanticVerifications);
  source.semanticVerifierModel = `hybrid:${model}`;
  source.semanticVerifiedAt = new Date().toISOString();
  source.semanticVerifiedContentHash = source.contentHash;
  source.semanticVerifiedEvidenceFingerprint = source.evidenceFingerprint;
  await persistSourceState(source);
}

feed.semanticVerification = {
  model: `hybrid:${model}`,
  attemptedClaims: attempted,
  completedClaims: completed,
  generatedAt: new Date().toISOString(),
};

await writeFile(feedPath, JSON.stringify(feed, null, 2));

console.log(`Independent verification complete: ${completed}/${attempted} claims classified.`);
