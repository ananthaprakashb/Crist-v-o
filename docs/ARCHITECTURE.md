# Cristóvão Architecture

## Product thesis

Most assistants answer the current question. Cristóvão builds a **living digital twin of a journey** and makes the dependency chain inspectable.

The core interaction is:

> **change one fact or source → recompute affected nodes → expose uncertainty → prove consequential claims with versioned evidence**

## Trust boundary

Cristóvão is an informational navigation and preparation tool. It is not legal advice and does not predict case outcomes.

The implementation keeps these concepts separate:

1. **Fact** — provided by the user or extracted from a document.
2. **Rule / evidence** — tied to a versioned authoritative source.
3. **Inference** — AI interpretation that never directly approves a graph node.
4. **Unknown** — information required before the system can safely conclude.
5. **Matched passage** — deterministic evidence extraction, not a semantic verdict.
6. **Semantic verdict** — an independent model classification.
7. **Verification state** — assigned by deterministic code after all gates are evaluated.

## Current architecture

```text
Natural-language intake
        |
        v
Structured Digital Twin
        |
        +--> Explicit unknowns
        +--> Document facts
        +--> Saved checkpoint
        |
        v
Journey Compiler -----------------> What-if / source impact
        |                                  |
        v                                  v
JourneyGraph ----------------------> selective invalidation
        |
        +--> Timeline
        +--> Explain Graph
        |
        v
Authoritative Source Intelligence
        |
        +--> versioned snapshot
        +--> SHA-256 fingerprint
        +--> deterministic passage matching
        +--> change detection
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
Verified / Needs-review / Rejected
```

## Runtime / persistence architecture

```text
Browser UI
   |
   v
Render Web Service
   |
   +--> structured-intake API
   +--> synthetic-document extraction API
   +--> checkpoint / compare API
   +--> live evidence-feed API
   |
   +-----------------------> Render Key Value
   |                           |
   |                           +--> latest evidence feed
   |                           +--> source snapshots
   |                           +--> journey checkpoint
   |
   +-----------------------> Supermemory
                               |
                               +--> semantic checkpoint history

Render Workflow
   |
   +--> load previous source state
   +--> snapshot official sources
   +--> verify matched claims
   +--> persist source state
   +--> publish evidence feed
```

The deterministic checkpoint stored in Render Key Value remains the comparison source of truth. Supermemory is a separate semantic-history sink and is not used to decide whether two snapshots are equal.

## Why the Journey Compiler is deterministic-first

Dates, graph traversal, dependency propagation, required-field validation, evidence-state transitions, checkpoint comparison, and known-date ordering are deterministic when possible.

AI is used where semantic interpretation is necessary:

- natural-language structuring,
- multimodal synthetic document understanding,
- claim-to-passage semantic verification.

Those AI paths are surrounded by explicit schemas, provenance, confidence/status fields, and abstention paths.

## Document reconciliation

Document extraction and the user/profile state remain separate observations until reconciliation.

If two observed values disagree, Cristóvão does not silently select one. The discrepancy remains visible and is propagated to connected graph/timeline state.

The synthetic demo intentionally includes a date conflict so reviewers can see that behavior directly.

## Timeline model

The timeline only orders exact dates that already exist in the Digital Twin or extracted document state.

If an exact date is missing, the item remains **UNSCHEDULED**. The system does not estimate legal dates merely to create a complete-looking timeline.

## Official-source flow

The prototype uses authoritative USCIS and U.S. Department of State evidence.

For registered sources the pipeline retains:

- publisher / URL,
- retrieval timestamp,
- source version,
- content hash,
- matched passage,
- claim-verification state,
- declared dependent JourneyGraph node IDs.

A source fingerprint change invalidates only declared dependents.

A changed fingerprint alone does **not** prove that the meaning of a rule changed. Semantic support must be re-established for the new retained content.

## Independent semantic verifier

The Journey Planner cannot grade itself.

A separate Gemini-based verifier receives:

- one explicit claim, and
- one already-matched source passage.

It returns one structured classification:

- `supported`
- `contradicted`
- `uncertain`

API/runtime failure remains `not-run`; it is not converted into a judgment.

## Deterministic acceptance gate

The model never marks a JourneyGraph node verified. Code requires the configured evidence checks to pass, including:

1. HTTPS source.
2. approved authoritative domain.
3. matched passage.
4. source version + retrieval timestamp + content hash.
5. retained evidence passage.
6. independent semantic verdict of `supported`.

A contradiction rejects the attached evidence. Missing or uncertain checks keep the node under review.

## Decision trace

The graph inspector follows relationships already present in the current Digital Twin:

- `dependsOn` edges,
- linked evidence IDs,
- evidence `supports` relationships,
- current verification / impact state.

The trace is therefore structural rather than a generated explanation that could invent a dependency.

## Memory model

Saving a checkpoint produces two intentionally separate paths:

### Deterministic checkpoint

Used by **What changed?** to compare the current Digital Twin against the saved baseline.

Collections compared include:

- facts,
- unknowns,
- graph nodes,
- evidence.

### Semantic history

When configured, a serialized checkpoint is also submitted to a scoped Supermemory container. This supports durable semantic history without replacing the deterministic state comparison.

## Judge Mode

Judge Mode is presentation-only. It does not add reasoning or bypass real controls.

It provides a movable presenter guide for the expected sequence:

```text
build state
 → save checkpoint
 → analyze synthetic document
 → inspect timeline
 → explain graph
 → simulate source change
 → compare with checkpoint
```

## Validation

The repository uses:

- Vitest unit tests,
- Render Workflow TypeScript checks,
- server TypeScript checks,
- production Vite build,
- Web API smoke test,
- GitHub Actions on pull requests.

## Safety model

Synthetic data is used for the hackathon demo. Cristóvão deliberately separates user facts, document observations, official evidence, deterministic extraction, AI semantic judgments, unknowns, and final verification state.

The desired failure mode is visible uncertainty, not fabricated certainty.
