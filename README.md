# Cristóvão the Caregiver

**AI-powered navigation for complicated life journeys.**

Cristóvão is a verified journey engine built for the **Open Atlas — AI for Social Good Hackathon 2026**, starting with the **Immigration & Mobility** track.

> Most immigration AI answers questions. Cristóvão builds a living digital twin of the journey, shows what changed, explains what is affected, and keeps consequential claims tied to authoritative evidence.

## The core demo

```text
change one fact or source
        ↓
recompute the Digital Twin + JourneyGraph
        ↓
show affected timeline / nodes
        ↓
explain dependency + evidence lineage
        ↓
retain uncertainty instead of inventing certainty
```

The strongest judge interaction is simple: **change one fact and watch the verified journey react.**

## What is implemented

### 1. Structured Digital Twin

Natural-language intake becomes structured journey state with explicit facts, family context, important dates, constraints, and missing information. Critical dates are never invented; unavailable facts remain explicit unknowns.

### 2. JourneyGraph compiler

Cristóvão compiles the current state into dependency-aware graph nodes that track upstream dependencies, evidence relationships, verification state, change impact, unresolved information, and next milestones.

Traversal, dependency propagation, state transitions, and date handling are deterministic-first rather than delegated to a language model.

### 3. Document intelligence + discrepancy detection

The synthetic I-797 demo extracts structured fields with per-field confidence and reconciles them against the Digital Twin.

The flagship demo intentionally exposes a conflict:

```text
Structured profile: 2026-09-30
Synthetic I-797:     2027-09-30
```

Cristóvão does **not** silently overwrite either value. Both observations remain visible, a discrepancy is recorded, connected graph nodes move to review, and the conflict propagates into the timeline.

### 4. Deterministic Journey Timeline

Known dates remain exact. Unknown dates remain **UNSCHEDULED**. The timeline separates observed dates, discrepancy review items, unresolved date anchors, and arithmetic attention bands based only on known dates. It does not fabricate filing deadlines or inferred legal dates.

### 5. Official Source Intelligence

Cristóvão monitors versioned authoritative evidence and retains source fingerprints, retrieval time, matched passages, and verification state. The prototype uses USCIS and U.S. Department of State evidence.

A changed source snapshot is **not automatically treated as a changed legal rule**. Interpretation returns to review until verification completes, and only JourneyGraph nodes that explicitly depend on that source are invalidated.

The source pipeline is also failure-aware. If an official host blocks cloud refresh, Cristóvão preserves the last usable/reference snapshot and reports **REFRESH-BLOCKED** rather than pretending the source is fresh or collapsing to an unexplained error. Retained reference evidence remains `not-run` for current verification until an official refresh succeeds.

### 6. Evidence Ledger + independent verification

A government URL alone is not enough to verify a consequential node. The evidence gate requires:

1. HTTPS transport.
2. Approved authoritative domain.
3. Specific matched passage.
4. Versioned snapshot metadata (`retrievedAt`, version, content hash).
5. Retained inspectable evidence text.
6. Independent support for the claim.

Where correctness can be directly tested from structured tables, deterministic validation is used. Where prose interpretation is necessary, Gemini receives the claim plus the already-matched evidence passage and returns one structured result: `supported`, `contradicted`, or `uncertain`. Runtime/model failure remains `not-run`.

The model never directly marks a JourneyGraph node verified; deterministic code applies the final verification gate.

### 7. Source-change impact simulator

The **Source change demo** injects a clearly labeled synthetic snapshot delta into the same impact path used by the live feed:

```text
prior source fingerprint
        ↓
changed fingerprint
        ↓
interpretation reset
        ↓
only declared dependent nodes invalidated
        ↓
verification required
```

The simulator never modifies persisted official-source data.

### 8. Explain Graph / Decision Trace

The **Explain graph** inspector lets a reviewer select a node and inspect recursive upstream dependencies, linked evidence records, evidence status, and the node's current verification / impact state. This exposes *why* the system reached the current state instead of presenting a black-box answer.

### 9. Journey memory + “What changed?”

Cristóvão can save a checkpoint of the current Digital Twin and later compare the current state against it. The deterministic comparison reports structural differences across facts, unknowns, graph nodes, and evidence.

When `REDIS_URL` is configured, checkpoints persist in **Render Key Value**. Without Redis, local development falls back to process memory.

When `SUPERMEMORY_API_KEY` is configured, the checkpoint is also submitted to a journey-scoped **Supermemory** container for semantic history. Semantic storage is intentionally separate from the deterministic comparison source of truth.

### 10. Guided Judge Mode

A movable **Judge demo** presenter rail guides a 2–3 minute walkthrough of the strongest product moments while keeping the underlying controls real. It coordinates the existing journey, document, timeline, graph, source-change, and memory experiences; it does not bypass or fake their results.

## Architecture

```text
Natural-language intake
        ↓
Structured Digital Twin
        ├── explicit unknowns
        ├── document facts
        └── saved checkpoint / memory
        ↓
Journey Compiler
        ↓
JourneyGraph ───────────────┐
        │                   │
        ├── Timeline        ├── Explain Graph
        │                   │
        ↓                   │
Source Intelligence         │
        ├── snapshot/version/hash
        ├── deterministic passage matching
        ├── refresh-blocked / retained-reference state
        └── source-change detection
        ↓
Evidence Ledger
        ↓
Independent Semantic Verifier
        ↓
Deterministic Verification Gate
        ↓
Verified / Needs-review / Rejected
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for more detail.

## Tech stack

**Frontend**
- React
- TypeScript
- Vite

**Backend**
- Node.js / TypeScript
- lightweight HTTP API

**AI**
- Gemini structured intake
- Gemini multimodal synthetic document extraction
- Gemini independent claim-to-passage semantic verification

**Workflow / persistence**
- Render Web Service
- Render Workflows
- Render Key Value
- Supermemory semantic journey history

**Evidence processing**
- deterministic HTML/PDF text extraction and claim matching
- SHA-256 source fingerprints
- explicit source version / retrieval metadata
- retained-reference handling for blocked official-source refreshes

**Validation**
- Vitest
- GitHub Actions
- Render Workflow typecheck
- server typecheck
- production build
- API smoke test

## Render Workflow

The deployed Workflow registers tasks for source-state loading, source snapshotting, claim verification, persistence, feed publishing, evidence refresh, and latest-feed retrieval.

The Web Service and Workflow share the Render Key Value connection through `REDIS_URL`, allowing source state, retained evidence, checkpoints, and the latest feed to survive across runs.

## Run locally

```bash
npm install
npm run build
npm run server:start
```

Open:

```text
http://localhost:3001
```

For local source-pipeline work:

```bash
npm run sources:snapshot
npm run sources:verify
```

Validate the repository:

```bash
npm test
npm run workflows:check
npm run server:check
npm run build
```

## Environment variables

```text
GEMINI_API_KEY=            # optional for Gemini-powered paths
GEMINI_MODEL=              # optional model override
REDIS_URL=                 # Render Key Value / Redis persistence
SUPERMEMORY_API_KEY=       # optional semantic journey history
PORT=3001
HOST=0.0.0.0
```

Never expose service keys in client-side Vite variables or commit them to the repository.

## Hackathon build disclosure

This repository was created during the Open Atlas 2026 submission window. The initial commit on **August 12, 2026 Pacific Time / August 13 UTC** contained only a two-line project description and no application implementation.

The Cristóvão application-specific implementation in this repository was built during the hackathon window, including:

- the Digital Twin and JourneyGraph compiler,
- structured intake,
- synthetic document intelligence and discrepancy reconciliation,
- deterministic timeline,
- evidence ledger and verification gate,
- official-source snapshot / hashing / impact pipeline,
- Render Workflows integration,
- source-refresh resilience and retained-reference state,
- Explain Graph,
- deterministic checkpoint comparison,
- Render Key Value persistence,
- Supermemory semantic-history integration,
- Guided Judge Mode,
- tests, CI, architecture documentation, and submission assets.

The project uses standard open-source libraries and external services listed above. No finished pre-existing Cristóvão application was submitted unchanged.

For auditability, the repository history preserves the original two-line initial commit and the subsequent implementation commits.

## Trust and safety model

Cristóvão is an informational navigation and preparation tool, **not legal advice**. The system deliberately distinguishes:

- user-provided facts,
- document-extracted facts,
- sourced rules/evidence,
- AI semantic judgments,
- deterministic calculations,
- and unresolved unknowns.

When required facts or evidence are missing, stale, blocked, or unresolved, the correct state is **needs review / unknown / refresh-blocked**, not an invented conclusion.

All submission demos use synthetic data and avoid real sensitive personal information.

## Demo assets

- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — 3-minute recording / live-demo script
- [`docs/CAPTURE_LIST.md`](docs/CAPTURE_LIST.md) — exact screenshots to capture for the submission and judge deck
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture and trust boundaries

## Current product thesis

**NewLife-style assistants organize services. Cristóvão models consequences.**

The product is intentionally deeper rather than broader: a reviewer should be able to change one fact, inspect exactly what changed, see which dependencies were affected, and trace the result back to evidence and verification state.
