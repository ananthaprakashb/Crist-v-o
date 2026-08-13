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

> **change one fact → recompute the journey → explain affected nodes → prove it with evidence**

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

The current source registry includes official USCIS and U.S. Department of State sources. The UI intentionally displays incomplete verifier checks rather than manufacturing a green verification badge.

### Automated validation

Vitest covers both the Journey Compiler and Evidence Engine. Tests specifically verify that:

- critical dates are not invented,
- what-if impact is limited to connected nodes,
- official-source registration alone does **not** verify a journey node,
- all evidence checks are required before verification, and
- contradictory evidence rejects a consequential node.

GitHub Actions runs unit tests and a production build for pull requests.

## Run locally

```bash
npm install
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

1. Server-side authoritative-source retrieval and versioned snapshots.
2. Evidence passage matching and semantic verification.
3. Policy-change diffing and graph impact propagation.
4. AI structured intake with schema validation.
5. Synthetic document extraction and cross-document discrepancy detection.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the target architecture.
