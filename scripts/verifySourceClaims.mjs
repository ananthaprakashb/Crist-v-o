import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { fingerprintClaims } from './lib/evidenceFingerprint.mjs';

const feedPath = process.env.SOURCE_FEED_PATH ?? path.resolve('public/source-intelligence.json');
const stateDir = process.env.SOURCE_STATE_DIR ?? path.resolve('data/source-snapshots');
const model = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is required. Set it in your environment before running npm run sources:verify.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

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

async function verifyClaim(source, claim) {
  const claimText = claimStatement(source, claim);
  const prompt = `You are an independent evidence verifier in a high-impact immigration information system.\n\nYour task is narrow: decide whether the EVIDENCE PASSAGE supports the CLAIM.\n\nRules:\n- Use only the supplied passage.\n- Do not use outside knowledge.\n- Do not infer legal eligibility, approval likelihood, or advice.\n- "supported" means the passage directly establishes the claim.\n- "contradicted" means the passage directly conflicts with the claim.\n- "uncertain" means the passage is ambiguous, incomplete, or does not establish the claim.\n- For table evidence, use the supplied section title, column headers, row label, and row values exactly as presented.\n- If the claim still depends on table position or context that is not preserved in the passage, choose uncertain.\n\nCLAIM:\n${claimText}\n\nEVIDENCE PASSAGE:\n${claim.passage}`;

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
    verifiedAt: new Date().toISOString(),
  };
}

function aggregate(verifications, expectedCount) {
  const completed = verifications.filter((item) => item.verdict !== 'not-run');
  if (completed.length !== expectedCount) return 'not-run';
  if (completed.some((item) => item.verdict === 'contradicted')) return 'contradicted';
  if (completed.some((item) => item.verdict === 'uncertain')) return 'uncertain';
  return completed.length > 0 && completed.every((item) => item.verdict === 'supported') ? 'supported' : 'not-run';
}

async function persistSourceState(source) {
  if (!source.contentHash || !source.evidenceFingerprint) return;
  const statePath = path.join(stateDir, `${source.id}.json`);
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    if (state.contentHash !== source.contentHash || state.evidenceFingerprint !== source.evidenceFingerprint) {
      console.log(`${source.id}: semantic verdict not persisted because source/evidence changed during verification.`);
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
    console.log(`${source.id}: could not persist semantic verdict to snapshot state: ${message}`);
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
      completed += 1;
      console.log(`${source.id}/${claim.claimId}: ${result.verdict} (${result.confidence})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      semanticVerifications.push({
        claimId: claim.claimId,
        claim: claimStatement(source, claim),
        verdict: 'not-run',
        confidence: 'low',
        rationale: 'Semantic verification did not complete.',
        model,
        verifiedAt: new Date().toISOString(),
        error: message,
      });
      console.log(`${source.id}/${claim.claimId}: verifier error: ${message}`);
    }
  }

  source.semanticVerifications = semanticVerifications;
  source.semanticSupport = aggregate(semanticVerifications, claims.length);
  source.semanticVerifierModel = model;
  source.semanticVerifiedAt = new Date().toISOString();
  source.semanticVerifiedContentHash = source.contentHash;
  source.semanticVerifiedEvidenceFingerprint = source.evidenceFingerprint;
  await persistSourceState(source);
}

feed.semanticVerification = {
  model,
  attemptedClaims: attempted,
  completedClaims: completed,
  generatedAt: new Date().toISOString(),
};

await writeFile(feedPath, JSON.stringify(feed, null, 2));

console.log(`Semantic verification complete: ${completed}/${attempted} claims classified.`);
