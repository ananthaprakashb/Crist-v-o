# Cristóvão — 3-Minute Demo Walkthrough

Target runtime: **2:40–2:55**. Use only synthetic demo data.

## Before recording

1. Start the latest build.
2. Confirm the evidence feed is already loaded.
3. Configure `SUPERMEMORY_API_KEY` if the semantic checkpoint indicator should show `submitted`.
4. Click **Judge demo → Reset demo state**.
5. Use a browser zoom level where the graph and floating controls remain readable.

## 0:00–0:18 — Product thesis

**Say:**

> Complex journeys are not one question. They are a dependency graph of facts, documents, dates, evidence, and changes over time. Cristóvão builds a verified digital twin of that journey and shows what changes when one input changes.

**Show:** product header and Digital Twin / JourneyGraph concept.

## 0:18–0:40 — Build the current state

**Action:** click **Build my journey**.

**Say:**

> Natural-language input becomes structured state. Missing information stays explicit instead of being guessed.

**Show:** structured intake, unresolved facts, and the JourneyGraph.

## 0:40–0:55 — Save a baseline

**Action:** open **Journey memory → Save checkpoint**.

**Say:**

> Before changing anything, I save the current Digital Twin. The deterministic snapshot is the comparison source of truth. Render Key Value provides persistence, while Supermemory can retain a separate semantic history.

**Show:** storage status and semantic-memory status.

## 0:55–1:25 — Document intelligence reveals a conflict

**Action:** run the synthetic document demo.

**Say:**

> The synthetic document is extracted independently. One observed validity date in the profile differs from the date extracted from the document. Cristóvão does not silently overwrite either value.

**Show:** extracted fields, the discrepancy banner, and both exact dates.

**Say:**

> Both observations remain visible until the mismatch is reviewed.

## 1:25–1:47 — Timeline recomputes

**Action:** open **Timeline preview**.

**Say:**

> The same discrepancy propagates into the chronological view. Both known dates remain exact, while missing date anchors stay unscheduled instead of being estimated.

**Show:** mismatch item, both exact dates, and at least one `UNSCHEDULED / UNKNOWN` item.

## 1:47–2:08 — Explain why

**Action:** open **Explain graph** and select an affected or unresolved node.

**Say:**

> Important nodes are inspectable. The reviewer can see the upstream dependency path, linked evidence records, and the node's current verification state.

**Show:** dependency path, evidence lineage, and current state.

## 2:08–2:32 — Simulate a source change

**Action:** open **Source change demo → Simulate source change**.

**Say:**

> Now I change a retained source snapshot. Cristóvão detects the fingerprint change, but it does not assume that the meaning changed. Interpretation returns to review, and only declared dependent nodes are invalidated.

**Show:** prior fingerprint, current fingerprint, `Pending verifier`, and affected graph nodes.

## 2:32–2:52 — Compare with the checkpoint

**Action:** open **Journey memory → What changed?**

**Say:**

> Cristóvão compares the current Digital Twin with the saved baseline and reports structural differences across facts, unknowns, graph nodes, and evidence.

**Show:** `STRUCTURAL CHANGES` and at least one changed collection.

## 2:52–3:00 — Close

**Say:**

> Cristóvão remembers the journey, shows consequences, exposes evidence, and preserves uncertainty when the system does not have enough information.

End on the JourneyGraph or evidence state.

## Recording notes

- Keep the cursor visible and deliberate.
- Do not scroll through every field.
- Avoid developer tools in the final recording.
- Use the already-loaded evidence feed rather than waiting on network calls during the recording.
- Close one right-side drawer before opening another.
- State once that the document and source-change interactions are synthetic demo scenarios.
