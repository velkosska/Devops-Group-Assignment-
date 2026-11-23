# UI

React (Vite + TypeScript) front end for the job application tracker: a landing page, the board,
quick add and edit, the application detail panel and the insights dashboard. It builds to static
files for Azure Static Web Apps.

| Path        | Page                                                            |
| ----------- | --------------------------------------------------------------- |
| `/`         | Landing page that explains the product and leads to the board   |
| `/board`    | The board; `/board?app=12` opens one application's detail panel |
| `/insights` | Funnel, time in stage and the follow-up list                    |

## Run locally

```bash
npm ci
npm run dev        # http://localhost:5173
```

API base URLs are read at build time from `VITE_APPLICATIONS_API_URL` and
`VITE_INSIGHTS_API_URL` (see `.env.example`). With no applications URL set, the UI runs on
sample data stored in the browser, so it can be explored before the services are up.
With only the applications URL set, the dashboard shows "Insights are temporarily unavailable".

## Checks

```bash
npm run lint && npm run format:check && npm run typecheck
npm test           # unit + user-journey tests
npm run coverage   # coverage of src/lib, src/api, src/state
npm run build      # static output in dist/
```

## Structure

| Folder            | What lives there                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/`        | Pure logic: stages, validation, dates, analytics and the insights-api response adapters             |
| `src/api/`        | HTTP client with timeouts, live clients for both services, and the in-browser demo backend          |
| `src/state/`      | Router, applications store (optimistic moves with undo and rollback), toasts, theme                 |
| `src/components/` | Shared building blocks: buttons, dialogs, menus, banners, badges                                    |
| `src/features/`   | Screens: landing page, board, application form and detail panel, insights, app shell and ⌘K palette |
| `src/styles/`     | Design tokens (light and dark) and component styles                                                 |

## API contract the UI expects

Matches `docs/proposal.md`. Errors may be `{"error": "..."}` or FastAPI's `{"detail": ...}`.

- `GET /applications`, `POST /applications`, `PUT /applications/{id}`,
  `PATCH /applications/{id}/stage` with `{"stage": "..."}`, `DELETE /applications/{id}`
- `GET /funnel`, `GET /time-in-stage`, `GET /stale?days=14`, optional `GET /timeline/{id}`

The analytics response shapes are not fixed yet, so `src/lib/analytics.ts` accepts either a
`{ "applied": 10, ... }` map or a list of `{ "stage": ..., "count": ... }` rows. A missing
`/timeline` endpoint (404) simply hides the history section.

## Failure behaviour

- Applications calls time out after 10 s (cold starts); the board shows a banner with
  "Try again" and disables adding while the service is down. A failed move or delete is rolled
  back with a message.
- Insights calls time out after 3 s and are retried once; the dashboard shows a banner and the
  board keeps working.
