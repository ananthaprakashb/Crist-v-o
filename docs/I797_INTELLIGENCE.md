# Structured Intake + Synthetic I-797 Intelligence

This slice adds two bounded capabilities to Cristóvão:

1. Structured intake turns synthetic free text into explicit profile fields and a visible missing-facts list.
2. Synthetic I-797 analysis extracts a narrow field set, preserves per-field confidence, and reconciles those values against the current profile without silently overwriting conflicts.

## Demo path

1. Keep the default synthetic scenario and click **Build my journey**.
2. The intake service records the stated approval end date as `2026-09-30`.
3. Click **Use synthetic I-797**.
4. The deterministic fixture extracts `Valid To: 2027-09-30`.
5. The UI shows both values, raises a discrepancy, and marks only the document/date-dependent journey nodes as impacted.

## Extraction modes

- `deterministic-synthetic`: reproducible built-in fixture; no model key required.
- `gemini-multimodal`: synthetic PDF/JPEG/PNG/WebP extraction through the Gemini Interactions API when `GEMINI_API_KEY` is configured.
- `deterministic-fallback`: structured intake fallback when Gemini is not configured or cannot complete.

The model is used only to extract explicitly visible or explicitly stated fields. It does not determine eligibility, approval likelihood, or legal conclusions.

## Environment

```text
GEMINI_API_KEY=<optional for AI intake and image/PDF extraction>
GEMINI_MODEL=gemini-3.6-flash
```

The deterministic demo path remains operational without either variable.
