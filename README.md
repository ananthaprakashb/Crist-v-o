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

Natural-language intake is converted into a structured journey state with explicit facts, family context, important dates, constraints, and missing information.

Critical dates are never invented. If a required fact is unavailable, it remains an explicit unknown.

### 2. JourneyGraph compiler

Cristóvão compiles the current state into dependency-aware graph nodes. The graph tracks:

- upstream dependencies,
- evidence relationships,
- verification state,
- change impact,
- unresolved information,
- and the next inspectable milestone.

The graph is deterministic-first: traversal, dependency propagation, state transitions, and date handling are code-driven rather than delegated to a language model.

### 3. Document intelligence + discrepancy detection

The synthetic I-797 demo extracts structured fields with per-field confidence and reconciles them against the Digital Twin.

The flagship demo intentionally exposes a conflict:

```text
Structured profile: 2026-09-30
Synthetic I-797:     2027-09-30
```

Cristóvão does **not** overwrite either value. It records a discrepancy, keeps both observations visible, marks connected graph nodes for review, and propagates the conflict into the timeline.

### 4. Deterministic Journey Timeline

Known dates remain exact. Unknown dates remain **UNSCHEDULED**.

The timeline separates:

- exact observed dates,
- discrepancy review items,
- unresolved date anchors,
- and arithmetic attention bands based only on known dates.

It does not fabricate filing deadlines or inferred legal dates.

### 5. Official Source Intelligence

Cristóvão monitors versioned authoritative evidence and keeps a source fingerprint, retrieval time, matched passage, and semantic-verification state.

The current source pipeline includes USCIS and U.S. Department of State evidence used by the prototype. Source changes are propagated only to JourneyGraph nodes explicitly declared as dependent on that source.

A changed source snapshot is **not automatically treated as a changed legal rule**. The affected interpretation is reset to review until verification completes.

### 6. Evidence Ledger + independent verification

A government URL alone is not enough to verify a consequential node.

The evidence gate requires:

1. HTTPS transport.
2. Approved authoritative domain.
3. Specific matched passage.
4. Versioned snapshot metadata (`retrievedAt`, version, content hash).
5. Retained inspectable evidence text.
6. Independent semantic support.

The semantic verifier receives a claim plus its already-matched passage and returns one structured result:

- `supported`
- `contradicted`
- `uncertain`

API/runtime failure remains `not-run`. The model never directly marks a JourneyGraph node verified; deterministic code applies the final gate.

### 7. Source-change impact simulator

The **Source change demo** injects a clearly labeled synthetic snapshot delta into the same impact path used by the live feed.

It demonstrates:

```text
prior source fingerprint
        ↓
changed fingerprint
        ↓
semantic interpretation reset
        ↓
only declared dependent nodes invalidated
        ↓
verification required
```

The simulator does not modify persisted official-source data.

### 8. Explain Graph / Decision Trace

The **Explain graph** inspector lets a reviewer select a current node and inspect:

- recursive upstream dependencies,
- linked evidence records,
- evidence status,
- and the node's current verification / impact state.

This gives the user a visible trace of *why* a node is in its current state instead of presenting a black-box answer.

### 9. Journey memory + “What changed?”

Cristóvão can save a checkpoint of the current Digital Twin and later compare the current state against it.

The deterministic comparison reports structural changes across:

- facts,
- unknowns,
- graph nodes,
- evidence.

When `REDIS_URL` is configured, checkpoints persist in **Render Key Value**. Without Redis, local development falls back to process memory.

When `SUPERMEMORY_API_KEY` is configured, the checkpoint is also submitted to a journey-scoped **Supermemory** container for durable semantic history. Semantic storage is intentionally separate from the deterministic comparison source of truth.

### 10. Guided Judge Mode

A movable **Judge demo** presenter rail guides a 2–3 minute walkthrough of the strongest product moments while keeping the underlying controls real.

The guide coordinates the existing journey, document, timeline, graph, source-change, and memory experiences; it does not bypass or fake their results.

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
- Gemini structured intake / multimodal synthetic document extraction
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

**Validation**
- Vitest
- GitHub Actions
- workflow typecheck
- server typecheck
- production build
- API smoke test

## Render Workflow

The deployed workflow registers tasks for source-state loading, source snapshotting, claim verification, persistence, feed publishing, evidence refresh, and latest-feed retrieval.

The Web Service and Workflow share the Render Key Value connection through `REDIS_URL`, allowing source state and the latest evidence feed to survive across runs.

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

## Trust and safety model

Cristóvão is an informational navigation and preparation tool, **not legal advice**. The system deliberately distinguishes:

- user-provided facts,
- document-extracted facts,
- sourced rules/evidence,
- AI semantic judgments,
- deterministic calculations,
- and unresolved unknowns.

When required facts or evidence are missing, the correct state is **needs review / unknown**, not an invented conclusion.

## Demo assets

- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — 3-minute recording / live-demo script
- [`docs/SCREENSHOT_CHECKLIST.md`](docs/SCREENSHOT_CHECKLIST.md) — exact screenshots to capture for Devpost and the judge deck
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture and trust boundaries

## Current product thesis

**NewLife-style assistants organize services. Cristóvão models consequences.**

The product is intentionally deeper rather than broader: a reviewer should be able to change one fact, inspect exactly what changed, see which dependencies were affected, and trace the result back to evidence and verification state.
