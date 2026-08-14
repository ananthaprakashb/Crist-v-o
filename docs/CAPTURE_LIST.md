# Cristóvão Capture List

Capture these after **Judge demo → Reset demo state**. Use only synthetic demo data.

## Priority captures

1. **Structured intake + JourneyGraph**
   - Show structured state and at least one explicit unknown.
   - Keep the graph visible enough to show dependency-aware nodes.

2. **Document discrepancy**
   - Show the discrepancy banner.
   - Show both observed dates side by side.
   - Make sure the message that both values remain visible is readable.

3. **Timeline reaction**
   - Show the mismatch review item.
   - Show both exact dates.
   - Include at least one `UNSCHEDULED / UNKNOWN` row.

4. **Explain graph**
   - Select an affected or unresolved node.
   - Show dependency path, evidence lineage, and current state in one frame if possible.

5. **Source change impact**
   - Show prior fingerprint → current fingerprint → `Pending verifier`.
   - Include the affected graph-node list.

6. **Journey memory comparison**
   - Show `STRUCTURAL CHANGES` with at least one changed collection.
   - If configured, include `Semantic memory: submitted`.

## Optional trust / reliability capture

7. **Production official-source resilience**
   - Show the U.S. Department of State Visa Bulletin card.
   - Status should read `REFRESH-BLOCKED`.
   - Version should be `August 2026`.
   - Hash must be non-empty.
   - Keep the `Affects 3 nodes` line visible if possible.
   - This frame is useful for the deck or Devpost screenshots because it demonstrates that blocked retrieval is represented explicitly rather than being hidden or mislabeled as verified.

## Optional architecture capture

Use the app plus the architecture diagram from `docs/ARCHITECTURE.md` for the judge deck rather than taking a screenshot of source code.

## Capture quality

- Desktop viewport around 1440×900 or similar.
- Browser zoom around 90–100% unless more space is needed.
- Hide bookmarks and unrelated browser chrome when recording the final video.
- Keep floating controls aligned and avoid multiple open drawers.
- Do not include API keys, environment-variable values, terminal secrets, Render internal URLs, resource IDs, or private account information.
- Prefer PNG for still screenshots.

## Suggested deck mapping

- Slide 1: Product thesis / hero.
- Slide 2: Digital Twin + document discrepancy + timeline.
- Slide 3: Evidence / verifier / source-change architecture; optionally use the `REFRESH-BLOCKED` + hash capture as reliability proof.
- Slide 4: Explainability + memory + Render/Supermemory stack.
- Slide 5: impact, differentiation, and next steps.

See [`DECK_OUTLINE.md`](DECK_OUTLINE.md) for the complete five-slide narrative.
