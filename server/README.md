# Cristóvão Evidence Web Service

This service exposes the latest Render Workflow evidence feed and serves the built React application from the same process.

## Endpoints

- `GET /healthz` — service health
- `GET /api/evidence/latest` — latest workflow feed from Render Key Value
- `GET /source-intelligence.json` — compatibility endpoint used by the React app; returns the live Key Value feed when available and falls back to the bundled static snapshot otherwise

## Local development

Build and start the production-shaped server:

```bash
npm install
npm run build
npm run server:check
npm run server:start
```

Open `http://localhost:3001`.

Without `REDIS_URL`, the UI intentionally uses `dist/source-intelligence.json` as a degraded-mode fallback.

To test the real live path, provide a Redis-compatible URL containing the workflow-published `cristovao:feed:latest` key:

```bash
REDIS_URL=<url> npm run server:start
```

## Render Web Service

Deploy this repository as a Render Web Service with:

```text
Build Command: npm install && npm run build
Start Command: npm run server:start
Health Check Path: /healthz
```

Environment:

```text
REDIS_URL=<same Render Key Value internal URL used by the Workflow service>
```

Keep the Web Service, Workflow service, and Key Value instance in the same Render region so the services can use the internal Key Value connection URL.

## Trust boundary

The browser never receives Redis credentials and never talks to Key Value directly. The server exposes only the sanitized feed already produced by `refreshImmigrationEvidence`. If Key Value is unavailable, the app displays the checked-in static snapshot rather than inventing fresh evidence.
