# Cristóvão — 5-Slide Judge Deck Outline

Keep the deck visual and sparse. Aim for 20–35 words of body text per slide, with screenshots doing most of the work.

## Slide 1 — The problem and thesis

### Title

**Cristóvão the Caregiver**

### Subtitle

**An AI Immigration Digital Twin + Verified Journey Engine**

### Core message

Immigration is not one question. It is a long-running dependency graph of facts, family milestones, documents, dates, and policy evidence.

**Most assistants answer questions. Cristóvão models consequences.**

### Visual

Use the hero / structured-intake + JourneyGraph screenshot.

### Judge criterion

**Impact + Creativity**

---

## Slide 2 — Change one fact, recompute the journey

### Title

**A living Digital Twin, not a static checklist**

### Left visual

Document discrepancy screenshot showing:

```text
Profile:        2026-09-30
Synthetic I-797: 2027-09-30
```

### Right visual

Timeline screenshot showing the review item plus at least one `UNSCHEDULED / UNKNOWN` item.

### Core message

Cristóvão keeps conflicting observations visible, propagates the discrepancy through the JourneyGraph, and recomputes the timeline without inventing missing dates.

### Judge criterion

**Impact + Technical Execution**

---

## Slide 3 — Evidence before confidence

### Title

**Verified claims need provenance, not just a government URL**

### Architecture strip

```text
Official source
  → snapshot/version/hash
  → deterministic passage match
  → independent verifier
  → deterministic gate
  → graph state
```

### Supporting visual

Use either:

- Source-change impact screenshot, or
- production source card showing `REFRESH-BLOCKED` + non-empty retained hash.

### Core message

A changed source fingerprint does not automatically mean a changed legal rule. If a government host blocks cloud refresh, Cristóvão preserves the evidence trail but refuses to call it freshly verified.

### Judge criterion

**Technical Execution + Feasibility**

---

## Slide 4 — Explainability + memory

### Title

**Show why it changed — and what changed since last time**

### Left visual

Explain Graph screenshot with dependency path and evidence lineage.

### Right visual

Journey memory comparison screenshot showing `STRUCTURAL CHANGES` and, if configured, `Semantic memory: submitted`.

### Core message

Render Key Value persists deterministic state. Supermemory stores separate semantic history. The user can inspect both the dependency trace and deterministic checkpoint differences.

### Small stack footer

**React · TypeScript · Gemini · Render Workflows · Render Key Value · Supermemory**

### Judge criterion

**Technical Execution + Creativity**

---

## Slide 5 — Why this can become a real product

### Title

**From immigration prototype to verified life-journey infrastructure**

### Three columns

**Today**

- Working Digital Twin + JourneyGraph
- Document discrepancy detection
- Evidence / source-change pipeline
- Explain Graph + checkpoint comparison

**Next**

- More official-source adapters
- Human / attorney review handoff
- Multilingual explanations
- Consent, retention, and deletion controls

**Potential**

- Immigration
- Credential recognition
- Newcomer settlement
- Education / benefits journeys

### Closing line

**Change one fact → recompute consequences → explain affected nodes → prove with evidence.**

### Judge criterion

**Feasibility + Impact**

---

## Screenshot assignment

1. Hero / JourneyGraph → Slide 1
2. Document discrepancy → Slide 2
3. Timeline → Slide 2
4. Source change or retained-source card → Slide 3
5. Explain Graph → Slide 4
6. What changed? → Slide 4

## Deck production notes

- 16:9 widescreen.
- Export final deck to PDF for Devpost.
- Keep screenshots at native resolution; crop rather than stretch.
- Do not show browser tabs, API keys, Render internal URLs, or account identifiers.
- Use synthetic data only.
- Use one dominant headline per slide.
- Avoid code screenshots; use the architecture diagram and product UI instead.
