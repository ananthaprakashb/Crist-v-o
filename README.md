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

## Day 1 prototype

This branch establishes the domain and UI foundation:

- React + TypeScript + Vite UI.
- Structured `DigitalTwin` model.
- Dependency-aware `JourneyGraph` nodes.
- Explicit unknown-fact detection.
- Deterministic what-if impact simulation.
- Evidence Ledger placeholders for authoritative sources.
- Deterministic Journey Readiness score.
- Vitest coverage for the Journey Compiler.

The initial compiler is deliberately deterministic and operates on **synthetic demo text only**. AI-based structured intake and the versioned evidence service are subsequent implementation slices.

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

Cristóvão is an informational navigation and preparation tool, **not legal advice**. High-impact conclusions must be tied to current authoritative evidence. The system explicitly distinguishes user facts, sourced rules, AI inferences, and unknown information.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the target architecture.
