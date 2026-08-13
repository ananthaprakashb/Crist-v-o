# Cristóvão Architecture

## Product thesis

Most immigration assistants answer questions. Cristóvão builds a **living digital twin of a journey** and makes the dependency chain inspectable.

The core interaction is:

> **change one fact or source → recompute affected nodes → expose uncertainty → prove consequential claims with versioned evidence**

## Trust boundary

Cristóvão is an informational navigation and preparation tool. It is not legal advice and must not predict case outcomes.

The implementation keeps these concepts separate:

1. **Fact** — provided by the user or extracted from a document.
2. **Rule** — tied to a versioned authoritative source.
3. **Inference** — AI reasoning that combines facts and rules.
4. **Unknown** — information required before the system can safely conclude.
5. **Matched passage** — deterministic evidence extraction, not a semantic verdict.
6. **Semantic verdict** — an independent model judgment that still cannot directly approve a node.

## Current architecture

```text
Natural-language intake
        |
        v
Structured Digital Twin
        |
        +--> Unknown detector
        |
        +--> Document facts
        |
        v
Journey Compiler ----------> What-if Scenario Engine
        |                           |
        v                           v
Proposed JourneyGraph -----> Impact propagation
        |
        v
Authoritative Source Intelligence
        |
        +--> snapshot + SHA-256 + version
        |
        +--> deterministic passage matching
        |
        v
Evidence Ledger
        |
        v
Independent Semantic Verifier
        |
        v
Deterministic Verification Gate
        |
        v
Verified / Needs-review / Rejected JourneyGraph
```

## Why the Journey Compiler is deterministic-first

Dates, graph traversal, dependency propagation, required-field validation, evidence-state transitions, and readiness calculation should be deterministic when possible. AI is used where semantic interpretation is necessary, but it is surrounded by explicit schemas, provenance, and abstention paths.

## Official source flow

The current prototype monitors:

- USCIS Policy Manual
- U.S. Department of State August 2026 Visa Bulletin

The State Department can return HTTP 403 to Node clients, so Cristóvão supports an official PDF fallback and browser-assisted official-file import. Fetch failures are recorded rather than hidden.

For the August 2026 bulletin, deterministic extraction currently isolates:

- EB-2 India Final Action value
- EB-2 India Dates-for-Filing value
- EB-2 availability-warning passage

Locating those passages does **not** verify the related claims.

## Independent semantic verifier

The Journey Planner cannot grade itself. A separate Gemini-based verifier receives only:

- one explicit claim, and
- one already-matched official passage.

It does not receive the user's broader profile, planner rationale, or web-search results. It is instructed to use only the supplied passage and return one structured classification:

- `supported`
- `contradicted`
- `uncertain`

API/runtime failure remains `not-run`; it is not converted into an AI verdict.

## Deterministic acceptance gate

The model never marks a JourneyGraph node verified. Code requires all of the following:

1. HTTPS source
2. approved authoritative domain
3. matched passage
4. source version + retrieval timestamp + content hash
5. retained evidence passage
6. independent semantic verdict of `supported`

A contradiction rejects the attached evidence. Missing or uncertain checks keep the node under review.

## Safety model

Synthetic data is used for the hackathon demo. Cristóvão deliberately separates user facts, official evidence, deterministic extraction, AI semantic judgments, unknowns, and final verification state.

## Next implementation slices

### Render Workflow orchestration

Move source snapshotting, extraction, semantic verification, and impact recomputation into a long-running workflow with persistent source state.

### AI intake

Replace the demo keyword compiler with structured model output validated against the Digital Twin schema. Critical dates remain unverified until corroborated by explicit input or documents.

### Document intelligence

Extract structured facts from synthetic immigration documents and compare them with user-entered facts. Discrepancies should become explicit unknowns rather than silent overwrites.

### Change intelligence

When a source changes, recompute affected claims and semantic verdicts, then mark only dependent JourneyGraph nodes for re-verification.
