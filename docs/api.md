# Right Pin API (backend branch)

Serverless functions in `api/` on Vercel, Postgres on Neon. No login: each browser creates a random workspace ID and sends it on every request. Decisions are always computed by `dist/engine.js`, on the server and in the browser, so both agree. If the API is unreachable the app keeps working in the browser and saves locally.

## Conventions
- Header `x-workspace-id: <uuid v4>` on every request except `/api/health`. The browser generates it once and keeps it in localStorage under `right-pin-workspace`.
- JSON in and out. Errors: `{ "error": "message" }` with status 400 (bad input), 409 (blocked by a rule), 413 (too large), 500 (server or database).
- Every write returns the full state (same shape as `GET /api/state`).

## State shape
```json
{
  "workspace": { "id": "...", "source": "sample-judge-test.xlsx", "settings": {"model":"industry-v2","minInvestment":30,"minArea":400,"minLaunch":3,"targetLaunch":6}, "warnings": [], "createdAt": "...", "updatedAt": "..." },
  "audit": [ { "at": "ISO date", "text": "APP-012: Confirmed bot update. Hold (needs a site) → Approve." } ],
  "apps": [ /* normalized applications, as Engine.normalize returns them */ ],
  "territories": [ /* {id, city, state, pins[], tier, slots, priority, issues[]} */ ],
  "onboarding": { "<app key>": { "tasks": {"0": true}, "taskDates": {"0": "2026-11-01"} } },
  "results": [ { "key": "...", "id": "APP-003", "name": "...", "status": "Recommended", "decision": {"label":"Approve","headline":"...","next":"..."}, "score": 95, "high": 95, "territory": "TER-02" } ]
}
```
A new workspace returns `workspace: null` and empty lists.

## Endpoints
| Method and path | Body | Result |
|---|---|---|
| `GET /api/health` | | `{ ok, db: "neon" or "memory", time }` |
| `GET /api/state` | | state |
| `POST /api/import` | `{ apps, territories, source, warnings, settings?, onboarding? }` | Replaces the workspace: uploads, sample data, or pushing the browser's copy. Validated with `Engine.validState` and `Engine.policyErrors`. |
| `POST /api/apps` | `{ key, patch, why }` | Changes template fields of one application (numbers must be non-negative). Returns `{ state, summary: { text, affected } }` with before → after and knock-on effects. Dependent onboarding steps are reset. |
| `POST /api/settings` | `{ settings }` | Saves the brand requirements and rescores everyone. |
| `POST /api/onboarding` | `{ key, tasks?, taskDates? }` | Saves the 7-step checklist. 409 if a step is skipped, if the partner is not Approve or Conditional, or if training is marked done without a confirmed language. |
| `POST /api/reset` | | Empties the workspace. |

## Tables
`workspaces` (settings, warnings, audit), `applications` (one row per application, JSON data), `territories`, `onboarding` (checklist per application). Created automatically on first request.

## Local development
`npm run dev` serves `dist/` and the API on http://localhost:8080 with an in-memory store. Set `DATABASE_URL` to use Postgres.
