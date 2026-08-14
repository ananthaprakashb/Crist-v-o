# Cristóvão the Caregiver — Devpost Submission Copy

Use this file as the source of truth when filling the Open Atlas Devpost form. Replace bracketed placeholders before submitting.

## Project name

**Cristóvão the Caregiver**

## Elevator pitch

Most immigration AI answers one question at a time. **Cristóvão builds a verified digital twin of an immigrant family's journey, models dependencies across facts, documents, dates, and policy evidence, and shows exactly what changes when one fact or source changes.**

Instead of hiding uncertainty behind confident text, Cristóvão keeps unknowns explicit, traces consequential nodes back to evidence, and recomputes the journey deterministically wherever correctness can be tested.

## Problem

Immigration is not a single form or question. A family's decisions depend on interacting facts: status, employer changes, dependent milestones, document validity dates, visa-bulletin movement, source updates, and information that may still be missing.

People often receive fragmented answers from search engines, chatbots, forums, or separate service providers. The difficult part is not only finding an answer; it is understanding **what that answer depends on, what changed since last time, which other parts of the journey are affected, and how trustworthy the evidence is**.

A wrong assumption or silently overwritten date can propagate through many downstream decisions. In a high-stakes domain, uncertainty needs to remain visible rather than being converted into plausible-sounding certainty.

## Who it is for

Cristóvão is designed for immigrants and immigrant families navigating long-running U.S. immigration journeys, especially journeys that span employment status, dependents, documents, policy sources, and changing life events.

The prototype uses a fully synthetic family scenario and synthetic document data. No real sensitive personal information is required for the demo.

## How it works

### 1. Build a structured Digital Twin

The user describes the current journey in natural language. Gemini helps structure the intake into explicit facts, family context, dates, constraints, and missing information.

Critical missing facts are not guessed. They remain explicit unknowns.

### 2. Compile a JourneyGraph

Cristóvão deterministically compiles the Digital Twin into dependency-aware nodes. Each consequential node can retain:

- upstream dependencies,
- evidence relationships,
- verification state,
- impact state,
- unresolved information,
- and next inspectable milestones.

### 3. Reconcile documents without silently overwriting facts

The demo includes a synthetic I-797 workflow. Gemini extracts structured fields with confidence, and deterministic reconciliation compares them with the Digital Twin.

The flagship scenario intentionally produces a discrepancy:

```text
Structured profile validity: 2026-09-30
Synthetic document validity: 2027-09-30
```

Cristóvão keeps both observations visible, records a discrepancy, and propagates the review state into connected graph nodes and the timeline.

### 4. Maintain a deterministic timeline

Known dates remain exact. Missing date anchors remain `UNSCHEDULED / UNKNOWN`.

Cristóvão does not fabricate filing deadlines, eligibility dates, or inferred legal dates.

### 5. Version official evidence

The source-intelligence pipeline snapshots authoritative sources, computes SHA-256 fingerprints, retains matched passages, detects source changes, and tracks which JourneyGraph nodes depend on each source.

A changed source fingerprint does not automatically mean the legal interpretation changed. The interpretation returns to review until verification completes.

The production demo also handles a real infrastructure edge case: if an official government host blocks automated cloud refresh, Cristóvão reports `REFRESH-BLOCKED`, preserves a retained reference/last-usable snapshot, and refuses to present that retained evidence as freshly verified.

### 6. Verify claims independently

Cristóvão separates source retrieval, passage matching, interpretation, and final graph verification.

Where structured evidence can be checked directly, deterministic validation is used. Where prose requires interpretation, Gemini receives only the claim and its already-matched evidence passage and returns a structured verdict such as `supported`, `contradicted`, or `uncertain`.

The model does not directly mark JourneyGraph nodes verified. Deterministic code applies the final gate.

### 7. Explain consequences

The Explain Graph inspector lets a reviewer select a node and inspect recursive dependencies, evidence lineage, and current verification state.

The source-change demo shows the central interaction:

```text
change one source fingerprint
        ↓
reset interpretation
        ↓
invalidate only declared dependent nodes
        ↓
require re-verification
```

### 8. Remember the journey

The user can save a deterministic checkpoint of the Digital Twin and later ask **What changed?**

Render Key Value persists checkpoints and source state. Supermemory can store a separate journey-scoped semantic history, while deterministic checkpoint comparison remains the source of truth for structural differences.

## Models, APIs, and frameworks

### Gemini

Gemini is used for work that benefits from generative or semantic reasoning:

- structured natural-language intake,
- multimodal extraction from the synthetic document demo,
- independent claim-to-passage semantic verification when deterministic validation is not sufficient.

Gemini is deliberately not used for deterministic graph traversal, date arithmetic, source fingerprinting, checkpoint diffing, or final verification-state transitions.

### Render

Render provides the deployed system backbone:

- **Web Service** for the React application and Node API,
- **Render Workflows** for the official-source snapshot / verification pipeline,
- **Render Key Value** for durable source state, latest evidence feed, and journey checkpoints.

The source pipeline is a meaningful Workflow use case rather than a background decoration: retrieval, fingerprinting, verification, persistence, and publication are separate workflow tasks.

### Supermemory

Supermemory receives optional journey-scoped semantic checkpoint history. It is intentionally kept separate from the deterministic comparison source of truth.

### Frontend / backend / validation

- React
- TypeScript
- Vite
- Node.js
- SHA-256 evidence fingerprints
- deterministic HTML/PDF evidence extraction and claim matching
- Vitest
- GitHub Actions

## What was built during the hackathon

The repository was created during the Open Atlas submission window. Its initial commit contained only a two-line project description and no application implementation.

The Cristóvão application-specific implementation was built during the hackathon window, including:

- Digital Twin and JourneyGraph compiler,
- structured intake,
- document intelligence and discrepancy reconciliation,
- deterministic timeline,
- evidence ledger and verification gate,
- official-source snapshot / fingerprint / impact pipeline,
- Render Workflows integration,
- blocked-source refresh resilience and retained-reference state,
- Explain Graph,
- deterministic checkpoint comparison,
- Render Key Value persistence,
- Supermemory integration,
- Guided Judge Mode,
- tests, CI, architecture documentation, and submission assets.

The project uses standard open-source libraries and the external services listed above. No finished pre-existing Cristóvão application was submitted unchanged.

## Technical challenges

### Government-source retrieval from cloud infrastructure

The U.S. Department of State Visa Bulletin was reachable interactively but automated retrieval from the deployed Workflow environment could be blocked. Rather than suppress the issue or hard-code a fake success state, Cristóvão added a provenance-labeled `REFRESH-BLOCKED` state and retained-reference fallback.

This became part of the trust model: retrieval failure, stale retained evidence, and verified current evidence are represented as different states.

### Separating probabilistic and deterministic work

A major design challenge was deciding where AI should be allowed to reason and where normal code should decide. Cristóvão uses AI for extraction and interpretation, but uses deterministic code for dependency propagation, hashes, date handling, checkpoint comparison, and final verification gates.

### Preserving conflicting observations

The document demo required avoiding the common pattern of merging two values into one "best" value. Cristóvão instead retains both observations and propagates the discrepancy through the graph and timeline.

## Impact

Cristóvão focuses on a recurring problem for immigrant families: journeys last years, facts change, policies change, documents disagree, and no single answer captures the dependencies.

The approach can reduce repeated manual reconstruction of the same case history, make uncertainty visible, help users prepare better questions for qualified professionals, and provide a transparent record of why the system believes a journey node needs attention.

The architecture is intentionally reusable beyond immigration. Any long-running life journey with changing facts, evidence, dependencies, and uncertainty can use the same verified-journey model.

## Creativity and originality

The core idea is not another immigration chatbot. Cristóvão treats the user's situation as a **versioned digital twin plus dependency graph** and makes **consequence modeling** the primary interaction.

The product thesis is:

> NewLife-style assistants organize services. Cristóvão models consequences.

The judge interaction is therefore not "ask it a question." It is:

> Change one fact. Watch the journey recompute. Inspect exactly what changed and why.

## Technical execution

The prototype demonstrates:

- working structured intake,
- a deterministic JourneyGraph,
- synthetic multimodal document extraction,
- discrepancy propagation,
- timeline recomputation,
- evidence fingerprints and retained passages,
- independent verification,
- source-change impact propagation,
- Render Workflow execution and persistent Key Value state,
- deterministic checkpoint comparison,
- optional Supermemory semantic history,
- automated tests and CI,
- and a guided judge-mode walkthrough.

## Feasibility / path to production

The next production steps are:

1. Generalize the current synthetic case schema into versioned journey templates.
2. Add more official immigration source adapters and source-specific deterministic parsers.
3. Add human-review / attorney handoff without turning Cristóvão into a legal-advice engine.
4. Add explicit consent, data-retention controls, encryption, and user-managed deletion before accepting real sensitive documents.
5. Add multilingual explanation while keeping evidence and deterministic state transitions language-independent.
6. Expand the verified-journey engine to adjacent newcomer workflows such as credential recognition, benefits, education, and settlement.

## Safety

Cristóvão is an informational navigation and preparation tool, **not legal advice**.

The system explicitly distinguishes user facts, document observations, official evidence, AI interpretations, deterministic calculations, and unresolved unknowns. Missing or stale evidence remains reviewable rather than being converted into a confident answer.

The submission demo uses synthetic data only.

## Recommended tracks

- **Best Immigration Solution**
- **Best use of Render Workflows**

## Demo video

**URL:** [ADD YOUTUBE OR VIMEO URL]

Target runtime: **2:40–2:55**.

Use [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) as the recording script.

## Public code repository

**GitHub:** https://github.com/ananthaprakashb/Crist-v-o

## Live demo

**URL:** [ADD LIVE RENDER URL]

## Screenshots

Use the six priority captures in [`CAPTURE_LIST.md`](CAPTURE_LIST.md):

1. Structured intake + JourneyGraph
2. Document discrepancy
3. Timeline reaction
4. Explain Graph
5. Source-change impact
6. Journey memory comparison

Also capture the production source card showing a non-empty retained evidence hash with `REFRESH-BLOCKED`; this is a useful trust/reliability proof if space allows.

## Team members

Add each Devpost-registered team member and role before submission.

- [NAME] — [ROLE]

## Final submission checklist

- [ ] Project name entered
- [ ] Elevator pitch entered
- [ ] Full description entered
- [ ] Hackathon/pre-existing disclosure included
- [ ] Models/APIs/frameworks described with actual responsibilities
- [ ] Challenges and next steps included
- [ ] Demo video <= 3 minutes and public/unlisted
- [ ] Public repository linked
- [ ] README setup instructions verified
- [ ] Team members and roles tagged
- [ ] Immigration Solution selected
- [ ] Render Workflows prize selected
- [ ] Screenshots uploaded
- [ ] 3–5 slide PDF deck uploaded if ready
- [ ] Live demo URL added
- [ ] No secrets or real sensitive PII visible
