# Cristóvão Render Workflows

This directory contains the managed source-intelligence orchestration for Cristóvão.

## Registered tasks

- `loadPreviousSourceState`
- `snapshotOfficialSources`
- `verifySourceClaims`
- `persistEvidenceState`
- `publishEvidenceFeed`
- `refreshImmigrationEvidence` — top-level orchestration task
- `getLatestEvidenceFeed`

The top-level flow is:

```text
load previous source state
        ↓
snapshot authoritative sources
        ↓
extract / match source claims
        ↓
independently verify claims
        ↓
persist versioned evidence state
        ↓
compute changed sources / affected JourneyGraph nodes
        ↓
publish latest evidence feed
```

## State

Render Workflow task runs execute independently, so source history is persisted in Render Key Value rather than relying on local task-instance files.

Set:

```text
REDIS_URL=<Render Key Value internal URL>
```

The workflow stores per-source state under:

```text
cristovao:source:<source-id>
```

and the latest sanitized feed under:

```text
cristovao:feed:latest
```

If `REDIS_URL` is absent, local execution works in `ephemeral` mode but source history is not durable across separate runs.

## Gemini

`GEMINI_API_KEY` is optional for the workflow's current core Visa Bulletin gate. Deterministic table claims are independently validated by code. Gemini is used only for semantic prose claims such as narrative policy warnings.

## Local Render Workflows development

Install the current Render CLI, then:

```bash
npm install
npm run workflows:check
npm run workflows:dev
```

In another terminal:

```bash
render workflows tasks list --local
render workflows start refreshImmigrationEvidence --local --input='[]'
```

For PowerShell, quote the JSON input as appropriate for your shell.

## Render deployment settings

Create a new **Workflow** service in the Render Dashboard and connect this repository/branch.

Recommended settings:

```text
Language: Node
Build Command: npm install
Start Command: npm run workflows:start
```

Use the same Render region as the Key Value instance so the workflow can use its internal connection URL.

Environment variables:

```text
REDIS_URL=<internal Render Key Value URL>
GEMINI_API_KEY=<optional for narrative semantic verification>
GEMINI_MODEL=gemini-3.6-flash
```

Trigger `refreshImmigrationEvidence` manually from the Render Dashboard/CLI first. Scheduling should be added with a Render Cron Job that triggers the task because Workflows do not currently provide native schedules.

## Web integration

The durable workflow output is now consumed by `server/src/index.ts`.

Production flow:

```text
Render Workflow
      ↓
cristovao:feed:latest (Render Key Value)
      ↓
Cristóvão Web Service
      ↓
/source-intelligence.json
      ↓
React Evidence Ledger + JourneyGraph
```

The browser never receives `REDIS_URL`. The server reads the sanitized workflow output and exposes it through `/api/evidence/latest`. For compatibility with the existing React feed contract, `/source-intelligence.json` serves the same live feed when Key Value is available and falls back to the bundled static snapshot when it is not.

See `server/README.md` for Web Service deployment settings.
