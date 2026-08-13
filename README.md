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

The independent verifier checks for:

1. HTTPS transport.
2. An allowed authoritative domain for primary evidence.
3. A specific matched passage.
4. Versioned snapshot metadata (`retrievedAt`, `sourceVersion`, and `contentHash`).
5. A retained evidence passage that a user or reviewer can inspect.
6. An independent semantic-support result.

Only when every required check passes can an attached evidence record become `verified`. A contradictory record becomes `rejected`; incomplete evidence stays `needs-review`.

### Source Intelligence

Cristóvão now has an executable official-source watcher rather than a simulated-only policy update.

Run:

```bash
npm run sources:snapshot
```

The watcher:

1. fetches registered official sources,
2. extracts and normalizes main page text,
3. computes a SHA-256 content hash,
4. retains the previous local snapshot,
5. detects first-seen / unchanged / changed states,
6. stores a small human-readable change summary,
7. writes `public/source-intelligence.json`, and
8. propagates a changed source only to JourneyGraph nodes declared as dependent on that source.

A successful snapshot supplies freshness, source version, and content hash to the Evidence Engine. It **does not** automatically mark a policy claim verified; matched passages and independent semantic support remain separate gates.

Fetch errors are captured as source status instead of silently falling back to stale or invented content.

Local snapshot state is stored under `data/source-snapshots/` and ignored by Git. The state directory can be overridden with `SOURCE_STATE_DIR`, which is intended for a persistent volume or object-backed implementation when this worker moves to Render Workflows.

### Automated validation

Vitest covers the Journey Compiler, Evidence Engine, and Source Intelligence layer. Tests verify that:

- critical dates are not invented,
- what-if impact is limited to connected nodes,
- official-source registration alone does **not** verify a journey node,
- all evidence checks are required before verification,
- contradictory evidence rejects a consequential node,
- a first source snapshot adds provenance without creating a fake policy change, and
- a real source change propagates only to declared dependent nodes.

GitHub Actions runs unit tests and a production build for pull requests.

## Run locally

```bash
npm install
npm run sources:snapshot
npm run dev
```

Validate:

```bash
npm test
npm run build
```

## Safety / trust model

Cristóvão is an informational navigation and preparation tool, **not legal advice**. High-impact conclusions must be tied to current authoritative evidence and pass independent verification. The system explicitly distinguishes user facts, sourced rules, AI inferences, and unknown information.

## Next implementation slices

1. Passage extraction and claim-to-passage matching.
2. AI semantic verification with structured output and deterministic acceptance rules.
3. Render Workflow orchestration and persistent source state.
4. AI structured intake with schema validation.
5. Synthetic document extraction and cross-document discrepancy detection.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the target architecture.
