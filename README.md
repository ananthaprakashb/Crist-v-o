# Cristóvão the Caregiver

**AI-powered navigation for complicated life journeys.**

Cristóvão is being built for the **Open Atlas — AI for Social Good Hackathon 2026**, starting with the **Immigration & Mobility** track.

## Product thesis

Most immigration AI answers questions. Cristóvão builds a **verified digital twin of a person's journey** so users can see:

- what is known,
- what is missing,
- what depends on what,
- which authoritative evidence supports a consequential action, and
- what changes when a life event or official source changes.

The core demo loop is:

> **change one fact or source → recompute the journey → explain affected nodes → prove it with evidence**

## Implemented foundation

### Digital Twin + JourneyGraph

- React + TypeScript + Vite UI.
- Structured `DigitalTwin` model.
- Dependency-aware `JourneyGraph` nodes.
- Explicit unknown-fact detection.
- Deterministic what-if impact simulation.
- Deterministic Journey Readiness score.

### Evidence Engine

Cristóvão deliberately separates **source registration** from **claim verification**. A government URL alone is not enough to mark a consequential journey node as supported.

The verifier gates are:

1. HTTPS transport.
2. An allowed authoritative domain for primary evidence.
3. A specific matched passage.
4. Versioned snapshot metadata (`retrievedAt`, `sourceVersion`, and `contentHash`).
5. A retained evidence passage that a user or reviewer can inspect.
6. An independent semantic-support result.

Only when every required check passes can an attached evidence record become `verified`. A contradictory record becomes `rejected`; incomplete evidence stays `needs-review`.

### Source Intelligence

Run:

```bash
npm run sources:snapshot
```

The watcher fetches registered official sources, snapshots and hashes them, extracts text from the State Department PDF fallback, and deterministically matches configured passages. For the August 2026 Visa Bulletin prototype, the matcher isolates the EB-2 India Final Action value, Dates-for-Filing value, and the EB-2 availability warning.

A source change propagates only to JourneyGraph nodes declared as dependent on that source. Fetch errors are recorded instead of silently substituting stale or invented content.

If automated State Department retrieval is blocked, use the browser-assisted official-file import:

```bash
npm run sources:import -- visa-bulletin-2026-08 "<path-to-official-file>"
```

### Independent semantic verifier

The deterministic matcher proves that a passage was located; it does **not** decide whether that passage semantically proves a claim. That is a separate agent responsibility.

Cristóvão uses the Gemini API only as an independent claim-to-passage classifier. The verifier receives the claim plus its already-matched official passage and is explicitly instructed not to use outside knowledge, make eligibility decisions, predict approval, or provide legal advice.

Set a Gemini API key and run:

```bash
npm run sources:verify
```

PowerShell example:

```powershell
$env:GEMINI_API_KEY="YOUR_KEY"
npm run sources:verify
```

Optional model override:

```powershell
$env:GEMINI_MODEL="gemini-3.6-flash"
```

Each claim receives one structured verdict:

- `supported`
- `contradicted`
- `uncertain`

An API/runtime failure is stored as `not-run`; it is never converted into an AI judgment. The source-level semantic result is deterministic: any contradiction rejects the source claim set, any uncertainty keeps it under review, and only complete support can satisfy the semantic verification gate.

### Automated validation

Vitest covers the Journey Compiler, Evidence Engine, Source Intelligence, and semantic-verdict feed integration. Tests verify that:

- critical dates are not invented,
- what-if impact is limited to connected nodes,
- official-source registration alone does **not** verify a journey node,
- all evidence checks are required before verification,
- contradictory evidence rejects a consequential node,
- a first source snapshot adds provenance without creating a fake policy change,
- matched passages do not pretend semantic verification ran,
- semantic verdicts are applied only when actually present, and
- a real source change propagates only to declared dependent nodes.

GitHub Actions runs unit tests and a production build for pull requests.

## Run locally

```bash
npm install
npm run sources:snapshot
npm run dev
```

Run semantic verification after the snapshot has matched passages:

```bash
npm run sources:verify
```

Validate:

```bash
npm test
npm run build
```

## Safety / trust model

Cristóvão is an informational navigation and preparation tool, **not legal advice**. High-impact conclusions must be tied to current authoritative evidence and pass independent verification. The system explicitly distinguishes user facts, sourced rules, AI inferences, unknown information, deterministic extraction, and AI semantic judgments.

## Next implementation slices

1. Render Workflow orchestration and persistent source state.
2. AI structured intake with schema validation.
3. Synthetic document extraction and cross-document discrepancy detection.
4. Policy-change semantic diffing and automated re-verification.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the target architecture.
