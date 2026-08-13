# Cristóvão Architecture — Day 1 Baseline

## Product thesis

Most immigration assistants answer questions. Cristóvão builds a **living digital twin of a journey** and makes the dependency chain inspectable.

The core interaction we are optimizing for is:

> change one fact → recompute affected nodes → ask for newly required facts → verify with authoritative evidence

## Trust boundary

Cristóvão is an informational navigation and preparation tool. It is not legal advice and must not predict case outcomes.

The implementation separates four concepts that many LLM applications blur together:

1. **Fact** — provided by the user or extracted from a document.
2. **Rule** — supported by a versioned authoritative source.
3. **Inference** — AI reasoning that combines facts and rules.
4. **Unknown** — information required before the system can safely conclude.

## Target architecture

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
Authoritative Retrieval
        |
        v
Evidence Ledger
        |
        v
Independent Verifier
        |
        v
Deterministic Validator
        |
        v
Verified JourneyGraph
```

## Why the Journey Compiler is deterministic-first

Dates, graph traversal, dependency propagation, required-field validation, evidence-state transitions, and readiness calculation should be deterministic when possible. AI will be added where semantic interpretation is necessary: intake extraction, document understanding, source matching, semantic policy diff, and plain-language explanations.

## Day 1 implemented

- Digital Twin domain model.
- Explicit unknown-fact model.
- JourneyGraph node model with dependencies.
- Deterministic synthetic intake compiler.
- What-if simulation with impact isolation.
- Deterministic readiness calculation.
- Evidence Ledger placeholders for USCIS Policy Manual and Department of State Visa Bulletin.
- Unit tests proving unknowns remain explicit and scenario simulation does not mutate baseline state.

## Next implementation slices

### Evidence service

Fetch only approved authoritative sources, retain source URL + retrieval time + content hash/version, chunk content, match passages to proposed rules, and prevent a node from reaching `supported` without evidence.

### AI intake

Replace the demo keyword compiler with structured model output validated against the Digital Twin schema. The model may extract candidate facts, but critical dates remain unverified until corroborated by user confirmation or documents.

### Independent verification

The planner that proposes a node cannot be the component that approves it. A separate verifier must challenge claim-to-evidence entailment and a deterministic validator must enforce graph invariants.

### Change intelligence

Persist source snapshots. When content changes, compute a semantic diff, map changed rule IDs to JourneyGraph nodes, and mark only dependent nodes for re-verification.
