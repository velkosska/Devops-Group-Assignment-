# Decision records

Short records of the choices that shaped the product. Format: context, decision,
alternatives, consequences.

---

## 1. Architecture: two services and a layered layout

### Context
The brief requires exactly two backend services, each with its own database,
talking over HTTP, plus a static UI. The product needs a fast board (current
state) and heavier analytics over history.

### Decision
- `applications-api` owns the current application records and board CRUD.
- `insights-api` owns stage-event history and analytics reads.
- The React UI calls both services from the browser; CORS allows only the Static
  Web App origin (or `http://localhost:5173` locally).
- Stage changes are pushed service-to-service with `POST /events` and a shared
  API key.
- Inside each service: `routes/` → `services/` → `domain/` → `repositories/`.
  Domain logic is pure and coverage-gated at 70%.

### Alternatives considered
- One monolithic API: simpler deploy, but fails the two-service requirement and
  couples board latency to analytics load.
- UI talks only to applications-api, which proxies insights: extra hop and a
  single point of failure for the dashboard.

### Consequences
- The board can keep working when insights is down (timeout + clear message).
- Two databases and two images to operate; sync is eventual and best-effort in
  the MVP (no outbox yet).

---

## 2. Storage: Azure SQL serverless per service

### Context
Each service needs durable storage. The brief mandates one serverless Azure SQL
database per service, SQL Server in local compose, and versioned migrations.

### Decision
- One Azure SQL serverless database per service; contained DB users
  (`applications_user`, `insights_user`) with no cross-database access.
- Locally: SQL Server 2022 in `docker-compose.yml`, one database per service.
- Schema only through Alembic migrations applied on startup, with a wait/retry
  for serverless auto-pause.
- No foreign keys across the two databases.

### Alternatives considered
- Shared database: rejected by the brief and by the isolation goal.
- SQLite in production: rejected by the brief; SQLite remains for unit tests
  only.

### Consequences
- Cold starts can take tens of seconds; probes and CD health checks must allow
  for that.
- CI never points at Azure SQL; compose and optional disposable SQL Server URLs
  cover integration tests.

---

## 3. Deployment and pipeline

### Context
The brief requires deploying to Azure on every merge to main, only if CI passed,
with images tagged by commit SHA, a post-deploy health check, scale to zero, no
secrets in the repository, and nothing changed by hand after the initial setup.
All of it runs in a shared IE subscription where we only have Contributor on our
resource group.

### Decision
- Every Azure resource is defined in Bicep in `infra/` (environment and logs, SQL
  server and databases, Static Web App, Container Apps) and deployed once from
  Cloud Shell, previewed with `what-if` first. One contained database user per
  service is created by `infra/create-db-users.sh`. The steps are in
  [azure-setup.md](azure-setup.md).
- CI runs on every pull request and push. CD runs on main only: it calls CI and
  the Docker build on the same commit and only if both pass pushes both images to
  GHCR tagged with the commit SHA, then points both Container Apps at those
  images and retries `/health` for up to about 5 minutes per service, failing the
  run otherwise. It then builds the UI with the live API addresses baked in and
  uploads it to the Static Web App.
- The pipeline signs in as the managed identity `sdd-3b-g4-github` through OIDC,
  trusted only for runs on main of this repository. No Azure password exists
  anywhere.
- Database URLs and the shared API key are stored only as Container App secrets.
  CD only changes the image, so it never needs them.
- Container Apps scale from 0 to 1 replica. The startup probe allows about 3.5
  minutes, so a paused database can resume and migrations can run.
- Branch protection (ruleset `protect-main`): a pull request with one approval and
  green CI (tests, secret scan, Dockerfile lint and image builds) is required to
  merge to `main`. The required CI checks were added on 24 November.

### Alternatives considered
- Azure CLI commands instead of Bicep: rejected, because Bicep is repeatable, can
  be previewed with `what-if`, and is credited by the brief.
- A service principal with a client secret: rejected, because a secret has to be
  stored and rotated; OIDC needs none.
- CD redeploying the Bicep on every merge: rejected, because it would need the
  database passwords as GitHub secrets.
- Azure Container Registry: rejected, because it has a fixed monthly cost; GHCR
  is free and the images contain no secrets, so they can be public.
- Blue-green deployment with revisions: not built, because it briefly runs two
  replicas while the brief caps us at one.

### Consequences
- The first request after a quiet period can take one to two minutes (container
  start plus database resume). The startup probe and the CD health check allow
  for it.
- Redeploying `infra/containerapps.bicep` needs the database passwords again, so
  the user script is run first to set new ones. This doubles as password rotation.
- On 23 November Azure suspended the Container Apps environment's compute.
  Because it was defined in Bicep, we deleted it and recreated it from the same
  Bicep file instead of rebuilding it by hand.
- The UI reads the API addresses at build time, so CD rebuilds it on every
  deploy. If either address were missing, the UI would quietly fall back to demo
  data, so the build fails instead.

---

## 4. Frontend: React (Vite) static UI

### Context
The brief wants a static UI on Azure Static Web Apps. The board and dashboard
must call the two APIs from the browser.

### Decision
- React + TypeScript + Vite in `ui/`, built to static files.
- API base URLs are build-time `VITE_APPLICATIONS_API_URL` and
  `VITE_INSIGHTS_API_URL`.
- Without the applications URL, the UI can run on in-browser sample data for
  demos. If insights is unreachable, the board still works and the dashboard
  shows a clear unavailable state.

### Alternatives considered
- Plain HTML/JS: less structure for board UX and tests.
- Server-rendered UI: out of scope for Static Web Apps as used here.

### Consequences
- CORS and the SWA origin must stay aligned with Container Apps settings.
- A bad build-time URL means a rebuild/redeploy of the UI, not a runtime config
  change inside the static files.

---

## 5. Monitoring and reliability

### Context
Both services need consistent request logging so the team can monitor
reliability in Azure.

### Decision
Both services log HTTP requests as structured JSON to stdout.

Each request log includes:
- HTTP method
- Request path
- Response status code
- Request duration in milliseconds

Azure Log Analytics is used to query these logs for request count, error rate
and response time. Shared saved queries form the monitoring dashboard. The board
API SLO targets 99% of logged `GET /applications` requests returning 2xx in
under 400 ms over seven days. The [monitoring guide](monitoring/README.md)
contains the queries and workspace verification steps.

### Alternatives considered
- Plain-text logs: harder to query consistently.
- Separate logging formats per service: complicates dashboards and SLO queries.

### Consequences
- Both services can share the same monitoring queries.
- Production errors and slow requests are easier to identify.
- Monitoring depends on successful log ingestion into Azure Log Analytics.
- The dashboard and SLO must be verified after deployment.
- The SLO measures application handling time for observed requests. Ingress
  failures and waits before the app receives a request are outside this measure.

---

## 6. Event delivery: best-effort push now, outbox later, no broker

### Context
insights-api needs every create, stage move and delete from applications-api to
build its history. The board must never fail or slow down badly because analytics
is down. The brief puts message brokers out of scope.

### Decision
- After its own database commit, applications-api sends `POST /events` to
  insights-api with a new `event_id` (UUID), an `X-API-Key` header and a
  two-second timeout (`INSIGHTS_TIMEOUT_SECONDS`).
- Any failure (timeout, connection error, non-202 status) is logged as a warning
  without the payload, URL or key, and the board request still succeeds.
- insights-api stores events idempotently on `event_id`: an identical replay is
  accepted, a different payload with the same id is rejected with 409.
- No retry and no outbox in the MVP.

### Alternatives considered
- Transactional outbox (an `outbox` table written in the same transaction,
  retried later): the proposal's stretch goal. Not built in time; it is the next
  step, and the idempotent `event_id` intake already makes retries safe.
- Message broker (Service Bus, Kafka): out of scope in the brief and an extra
  paid resource.
- insights-api reading the applications database directly: breaks the
  one-database-per-service rule.
- Synchronous "both or nothing" writes: would make the board fail whenever
  analytics fails, which is the coupling the split exists to avoid.

### Consequences
- Analytics are eventually consistent and can permanently miss an event sent
  while insights-api was down. This is a known, documented gap.
- A board write waits for the send, so with insights-api down a stage move takes
  up to about two seconds longer (2.59 s measured locally).
- The CD smoke test proves the event crosses between the services on every
  deploy: the funnel total goes up after create and back down after delete.

---

## 7. Cold starts: scale to zero and serverless auto-pause

### Context
The brief caps us at one replica per Container App and asks for scale to zero.
Azure SQL serverless pauses after 15 idle minutes. Our SLO is on board latency.

### Decision
- Keep `minReplicas: 0` and auto-pause on, to stay within the brief and the
  budget.
- Allow for the worst case instead of hiding it: startup retry for the database
  (up to 90 s), a startup probe of about 3.5 minutes, a CD health check of up to
  about 5 minutes, and a three-second UI timeout with one retry on insights.
- `/health` does not touch the database, so a paused database does not make the
  container restart in a loop.

### Alternatives considered
- `minReplicas: 1` and no auto-pause: fast first requests, but always-on cost
  and against the brief's scale-to-zero requirement.
- A scheduled "keep warm" ping: hides the real behaviour and still costs compute.

### Consequences
- The first request after a quiet period can take 30 seconds to two minutes, or
  return a 503. The README warns about this; before a demo we pre-warm both
  services.
- Cold-start requests show up as slow in the logs and count against the SLO; we
  report them rather than filtering them out.
