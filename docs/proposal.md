# Job Application Tracker \
 Project Proposal

## Summary

We will build **a job application tracker**: a kanban board of job applications (Applied → Phone screen → Interview → Offer / Rejected) plus a pipeline-analytics dashboard showing where applications drop off and which have gone quiet.

It runs as two services on Azure Container Apps, each with its own serverless Azure SQL database, behind a static React UI on Azure Static Web Apps. It is deployed by GitHub Actions on every merge to main and monitored through Log Analytics against one SLO.

The MVP is deliberately small: one entity with full CRUD, one analytics feature, and a clear fallback when either service is down. Everything else is a stretch goal added only on top of a working, deployed MVP.

## Why this idea fits the brief

Every hard requirement maps onto a natural part of the product, so no requirement has to be bolted on.

| Brief requirement | How the job tracker meets it |
| --- | --- |
| Static UI on Static Web Apps | React (Vite) board and dashboard, built to static files |
| One entity with full CRUD | Applications: create, list, view, edit, delete |
| One feature beyond CRUD | Pipeline analytics: stage conversion, time in stage, stale alerts |
| Exactly two services, own DB each, over HTTP | `applications-api` and `insights-api`, each with its own Azure SQL database |
| Partial failure handled | Board keeps working when insights is down; dashboard shows a clear message |
| Justified split | Current state (board) vs. history and heavy reads (analytics) |

It is also easy to explain to recruiters: everyone who has job-hunted understands it, and the event sync gives a real architecture story (the outbox pattern).

## Architecture

The browser loads a static React app that calls both services directly; `applications-api` also pushes stage events to `insights-api`, and both log to Log Analytics.

&#91;embedded content: architecture · 2 services, 2 databases, 1 static UI\]

**Why two services:** the board stores the current state of each application and must always be fast, while insights store the full history of stage changes and run heavier aggregate reads. Splitting them lets the board keep working when analytics fail, and gives each its own schema and database.

**Inside each service:** a simple layered structure — `routes/` (HTTP), `services/` (use cases), `domain/` (pure logic, the tested core), `repositories/` (SQL). It is small enough to learn in an hour and keeps the business rules free of framework code.

## Data model

Each service owns its tables; there are no foreign keys across the two databases. `application_id` in `insights-api` is a plain reference, and orphaned events after a delete are handled by a delete event (see sync section).

**applications-api database** (`sdd-<class>-g<N>-api-db`)

| Table | Columns | Notes |
| --- | --- | --- |
| `applications` | id, company, role, url, stage, location, salary\_range, applied\_at, created\_at, updated\_at | `stage` is one of: applied, screen, interview, offer, rejected |
| `notes` (stretch) | id, application\_id → applications, body, created\_at | Cascade delete with the application |
| `outbox` (stretch) | id, payload (JSON), created\_at, sent\_at | Unsent stage events waiting to be retried |

**insights-api database** (`sdd-<class>-g<N>-insights-db`)

| Table | Columns | Notes |
| --- | --- | --- |
| `stage_events` | id, event\_id (unique), application\_id, from\_stage, to\_stage, occurred\_at | `event_id` makes retries idempotent |

Both schemas are created by versioned migration files (Alembic for Python or Knex/Prisma migrations for Node) applied on container startup. `docs/data-model.md` gets an ER diagram that matches these migrations exactly.

## API endpoints

Both services expose `GET /health` and log one line per request (method, path, status, duration).

| Service | Method & path | Purpose |
| --- | --- | --- |
| applications-api | `GET /applications?stage=` | List applications, optional stage filter |
| applications-api | `POST /applications` | Create an application (sends a stage event) |
| applications-api | `GET /applications/{id}` | One application |
| applications-api | `PUT /applications/{id}` | Edit details |
| applications-api | `PATCH /applications/{id}/stage` | Move to another stage (sends a stage event) |
| applications-api | `DELETE /applications/{id}` | Delete (sends a delete event) |
| insights-api | `POST /events` | Receive a stage-change or delete event (idempotent on `event_id`) |
| insights-api | `GET /funnel` | Conversion rate per stage |
| insights-api | `GET /time-in-stage` | Median days spent in each stage |
| insights-api | `GET /stale?days=14` | Applications with no movement for N days |
| insights-api | `GET /timeline/{application_id}` (stretch) | Stage history of one application |

CORS on both services allows only the Static Web App origin. `POST /events` is called service-to-service and is protected by a shared API key held as a Container Apps secret.

## Feature beyond CRUD: pipeline analytics

`insights-api` turns the log of stage changes into three answers a job seeker actually wants.

1. **Funnel conversion:** of all applications, what share reached each stage. Example: 40% reach a phone screen, 25% of those reach an interview.
2. **Time in stage:** the median number of days between entering a stage and leaving it, which shows how slowly companies reply.
3. **Stale alerts:** applications whose last event is older than N days (default 14) and not in a final stage, so the user follows up.

All three are pure functions over a list of events, kept in a `domain/analytics` module with no database or HTTP code. That makes them fast to unit-test and the main source of the 70% core-logic coverage.

Edge cases to test: no events (0%, never divide by zero); a rejection after an interview still counts as having reached interview; an application moved backwards; events arriving out of order; a deleted application disappearing from all stats.

## Keeping the services in sync

`applications-api` pushes a small event to `insights-api` over HTTP whenever an application is created, changes stage or is deleted; the board never waits on analytics.

1. The user moves a card. `applications-api` saves the new stage in its own database.
2. It sends `POST /events` to `insights-api` with an `event_id` (UUID), `application_id`, `from_stage`, `to_stage` and timestamp, using a 2-second timeout.
3. If the call succeeds, done. If it fails or times out, the board still returns 200 to the user.
4. **MVP:** the failure is logged as a warning and that event is lost (a known, documented gap).
5. **Stretch — outbox:** the event is written to an `outbox` table in the same transaction as the stage change, and unsent rows are retried at the start of the next request. `insights-api` ignores duplicate `event_id`s, so retries are safe.

This is a simplified **transactional outbox**, and it is the main decision record for the project: it explains why we accept eventual consistency in analytics in exchange for a board that never fails because of them. No message broker is used, as the brief puts brokers out of scope.

## Frontend screens

A React app built with Vite to static files, deployed to `sdd-<class>-g<N>-ui`. API base URLs come from build-time environment variables, never hard-coded.

| Screen | What it does | MVP? |
| --- | --- | --- |
| Board | Columns per stage; cards move with buttons (← →) in the MVP, drag and drop as a stretch | Yes |
| Quick add / edit form | Create or edit an application, with validation messages | Yes |
| Insights dashboard | Funnel chart, time-in-stage bars, stale list | Yes |
| Application detail | Info, notes, stage timeline | Stretch |

Every call to a service uses a timeout and shows a visible banner on failure ("Insights are temporarily unavailable") instead of a spinner that never ends.

## Partial failure behaviour

Either service can be down without taking the other with it, and no flow hangs or shows a stack trace.

| What fails | What still works | What the user sees |
| --- | --- | --- |
| `insights-api` down | Full board: create, edit, move, delete | Dashboard banner "Insights are temporarily unavailable" after a 3 s UI timeout; stage events lost (MVP) or queued in the outbox (stretch) |
| `applications-api` down | Dashboard with the stats already computed | Board banner "Applications are temporarily unavailable"; buttons disabled |
| Insights DB waking from auto-pause | Board unaffected | Dashboard may take a few seconds; retried once, then the banner |

**Demo plan:** in the Sprint Review, point `applications-api`'s `INSIGHTS_URL` at a dead address (or stop the insights container locally), move a card to show the board still works, then open the dashboard to show the clear message. Errors are returned as JSON `{"error": "..."}` with a proper status code (502/503/504), never a framework error page.

## Azure deployment and naming

All resources go in our existing resource group `rg-sdd-<class>-g<N>`, created with Bicep and deployed by our group's service principal. Nothing is changed by hand after the first run.

| Resource | Name | Settings |
| --- | --- | --- |
| Container App | `sdd-<class>-g<N>-api` | Consumption plan, min 0 / max 1 replica, image from GHCR tagged with commit SHA |
| Container App | `sdd-<class>-g<N>-insights` | Same settings |
| Azure SQL database | `sdd-<class>-g<N>-api-db` | Serverless, auto-pause on |
| Azure SQL database | `sdd-<class>-g<N>-insights-db` | Serverless, auto-pause on |
| Static Web App | `sdd-<class>-g<N>-ui` | Free tier; only allowed CORS origin |
| Log Analytics | Workspace of the Container Apps environment | INFO level, no request bodies |

That is the maximum the brief allows: 2 Container Apps, 2 serverless databases, 1 Static Web App. Connection strings and the service-to-service API key are Container Apps secrets fed from GitHub secrets. Locally, `docker compose up` runs both services against a SQL Server container; CI never touches the Azure databases.

Open question: confirm our exact group number and class to fill in `<class>` and `<N>`.

## CI/CD pipeline

Two GitHub Actions workflows: CI on every pull request and push, CD only on merge to main after CI passes. `main` is protected: a reviewed, approved PR and green CI are required.

**CI (each service and the UI, in parallel jobs)**

1. Lint and format check (Ruff + Black, or ESLint + Prettier).
2. Unit and integration tests with coverage; fail below 70% on core logic.
3. Security scan: `pip-audit` or `npm audit`, plus Bandit or CodeQL.
4. Build the Docker image (not pushed).

**CD (on merge to main)**

1. Push images to GHCR tagged with the commit SHA.
2. Deploy a new Container Apps revision for each service with 0% traffic (blue-green).
3. Migrations run on container startup.
4. Poll the new revision's `/health` every 10 s for up to 3 minutes (cold start + database wake-up); fail the run if it never returns 200.
5. Shift 100% of traffic to the new revision; the old one stays available for instant rollback.
6. Build and deploy the UI to Static Web Apps.
7. Smoke test against the public URLs: create, read and delete one application, then read the funnel.

**Credited extras covered:** Bicep IaC, blue-green with revisions, smoke test against the deployed URL, and a release scheme (semantic version tags `v0.1.0`, `v0.2.0` at the end of each sprint, plus the final `submission` tag).

## Monitoring, dashboard and SLO

**SLO:** 99% of `GET /applications` requests return in under 400 ms over a rolling 7 days. Loading the board is the request users feel most.

Each service writes one JSON log line per request to stdout, for example `{"method":"GET","path":"/applications","status":200,"duration_ms":42}`. Container Apps ships these to Log Analytics, where the dashboard is built from saved queries in an Azure Workbook:

| Panel | Query idea |
| --- | --- |
| Request count | Requests per 5 minutes, split by service |
| Error rate | Share of status ≥ 500 per 5 minutes |
| Response time | p50 and p95 `duration_ms` per service |
| SLO | Share of `GET /applications` under 400 ms over 7 days, against the 99% target |

The SLO query (adjust the table name to what the workspace shows):

```
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(7d)
| where ContainerAppName_s == "sdd-<class>-g<N>-api"
| extend r = parse_json(Log_s)
| where r.method == "GET" and r.path == "/applications"
| summarize total = count(), fast = countif(toint(r.duration_ms) < 400)
| extend slo_percent = round(100.0 * fast / total, 2), target = 99.0
```

Cold starts after scale-to-zero will show as slow requests. We document this trade-off in `decisions.md` and report it honestly rather than hiding it.

## Testing strategy

The target is at least 80% coverage on core logic, comfortably above the 70% gate, because the analytics are pure functions.

| Level | What it covers | Where it runs |
| --- | --- | --- |
| Unit | Funnel, time-in-stage and stale calculations; stage-transition rules; input validation | CI, every PR |
| Integration | Each service's endpoints against SQL Server in Docker, including migrations | CI, every PR |
| Contract / failure | `applications-api` still returns 200 when `insights-api` times out (mocked); duplicate `event_id` ignored | CI, every PR |
| Smoke | Create, read, delete an application and read the funnel on the live URLs | CD, after deploy |

Coverage is measured per service on its core modules (`domain/`), so framework glue does not inflate or deflate the number.

## Scope: MVP vs stretch

Stretch items start only once the MVP is deployed and passing on main. They are listed in priority order, so we cut from the bottom.

**MVP (must ship)**

- Applications CRUD with stage moves (buttons)
- Stage events sent to `insights-api`
- Funnel, time-in-stage and stale-alert endpoints and dashboard
- Partial-failure banners and timeouts on both sides
- Full CI/CD with health check, dashboard and SLO query

**Stretch (in order)**

1. Blue-green deploys and the post-deploy smoke test
2. Bicep for all resources
3. Outbox with retry
4. Drag and drop on the board
5. Notes and the application timeline view

Items 1–2 are credited extras and worth more than features, so they come before any new UI work.

## Sprint plan

The first milestone is a "hello world" of both services deployed to Azure by the pipeline by 18 November; everything after that is iteration on a working main branch.

| Dates | Sprint | Goal | Done when |
| --- | --- | --- | --- |
| 17 Nov (tonight) | Sprint 0 catch-up | Idea agreed, backlog of 8–10 user stories, Definition of Done, roles recorded | `docs/scrum/sprint-0.md` and `definition-of-done.md` merged by PR |
| 18 Nov | Sprint 1 | Both services return `/health` on Azure via the pipeline; branch protection on | CD run green, live URLs in README |
| 18 Nov | Sprint 1 Review + Retro, Sprint 2 Planning (S30) | Show the deployed skeleton; plan Sprint 2 | `sprint-1.md` written the same day |
| 19–20 Nov | Sprint 2 | Applications CRUD and board end to end | Merged, deployed, tested |
| 20–21 Nov | Sprint 2 | Stage events, analytics endpoints, dashboard | Funnel visible on live site |
| 21–22 Nov | Sprint 2 | Partial-failure handling, Workbook, SLO query | Failure demo works on Azure |
| 22–23 Nov | Sprint 2 | Bicep, blue-green, smoke test, README and decision records | All docs match the deployment |
| 24 Nov, 23:59 | Deadline | `sprint-2.md`, `AI_USAGE.md`, tag `submission` | Tag pushed, URL and SHA on Blackboard |
| 25–26 Nov | Sprint Review | 10-minute live demo, every member presents | Rehearsed, services pre-warmed, backup recording ready |

Product Owner and Scrum Master rotate each sprint; we record who held each role in each sprint file.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A credential committed to Git | Team grade capped at 40/100 | Secret scanning and push protection on from day one; `.env` in `.gitignore`; rotate and report immediately if it happens |
| Pipeline not deployed by 18 Nov | Every later item slips | Skeleton deploy is the only goal until it works; the whole team helps |
| Cold start fails the post-deploy health check | Red CD runs, flaky demo | 3-minute retry loop; pre-warm both services and databases before the review |
| Scrum evidence looks reconstructed | Lost Scrum Process marks | Write sprint files on the day of each event; small PRs from everyone across the week |
| A member cannot explain their part | Lower individual grade | Each member pairs on one area outside their own; short walkthrough before the review |
| Drag and drop or charts eat the week | MVP incomplete | Buttons and simple charts first; drag and drop only as stretch |
| Live demo fails | Lost demo marks | Recorded pipeline run as backup, as the brief allows |

## Rubric mapping

This maps each graded category to where the proposal covers it; the expected range is our own estimate if we deliver the MVP plus stretch items 1–2.

| Category | Weight | Covered by | Our estimate |
| --- | --- | --- | --- |
| Product, Architecture & Code Quality | 25% | Two-service split, analytics feature, layered services | 23–25 |
| Cloud Infrastructure | 15% | Deployment contract, naming, Bicep | 14–15 |
| DevOps Pipeline | 20% | CI/CD, blue-green, smoke test, release tags | 19–20 |
| Testing | 10% | Pure analytics functions, integration and failure tests | 9–10 |
| Monitoring & Reliability | 10% | Workbook, SLO query, partial-failure handling | 9–10 |
| Scrum Process | 10% | GitHub Project, sprint files, reviewed PRs, role rotation | 7–10 |
| Documentation & Sprint Review | 10% | README, decision records, data model, live demo | 9–10 |

**Decision records to write in `docs/decisions.md`:** (1) why two services split by current state vs. history; (2) Azure SQL serverless and eventual consistency between the databases; (3) push events with an outbox instead of a broker; (4) blue-green deployment and the health-check timeout; (5) logging format, dashboard and SLO choice; (6) cold-start trade-off of scale-to-zero.
