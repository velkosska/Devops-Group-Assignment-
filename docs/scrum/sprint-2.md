# Sprint 2 (19–24 November)

## Roles
- Product Owner: TODO (confirm with team before the Sprint Review)
- Scrum Master: TODO (confirm with team before the Sprint Review)
- Developers: Marija (`velkosska`), Aakriti (`adh-aakriti`), Alejandro (`alejandroserranosanchez`), Khadeja (`digaaaa`), Edard (`edardhala`)

## Sprint Goal
MVP complete enough to demo: board CRUD, insights beyond CRUD, CI/CD, deploy to
Azure, monitoring queries, and documentation. Keep `main` mergeable through
reviewed pull requests.

## Items selected
- Finish both APIs (CRUD, stage events, analytics)
- Containers, compose, CI and CD
- Azure resources (Bicep) and first live deploy
- Static UI on Static Web Apps
- Monitoring queries and SLO
- Docs: decisions, data model, sprint records, README

## Done
- applications-api: settings, logging, CORS, database + migrations, service/repo,
  HTTP CRUD routes, SQL Server integration test option
- insights-api: scaffold, logging/CORS, analytics, event storage, analytics from
  history, ODBC image, stage-event intake from applications
- CI: lint, format, tests, coverage gate, bandit, pip-audit, gitleaks, CodeQL,
  Dependabot, Dockerfile build/hadolint, compose smoke
- CD part 1: on `main`, re-run CI/Docker and push SHA-tagged images to GHCR
- IaC: Log Analytics + Container Apps environment, SQL + two databases, SWA,
  Container Apps Bicep, DB user script
- Local `docker compose up` for SQL Server and both APIs
- React UI: landing, board, insights (merged); board/insights polish
- Monitoring: decision record, KQL queries and SLO write-up
- Process: GitHub Project stories, branch protection, `.mailmap`, `AI_USAGE.md`

## Not done (at time of writing)
- Monitoring dashboard and SLO verified against production Log Analytics
- Formal Sprint 2 Review / Retrospective write-up after the in-class sessions
  (25–26 November)
- Final `submission` tag on `main`

## Done later in the sprint (23 November)
- Container Apps environment recreated after Azure suspension; both APIs live
  with `/health` 200
- CD part 2 merged: image swap, `/health` gate, UI build/upload to Static Web Apps
- Live URLs and architecture sketch added to the README

## Sprint Review
In class on 25–26 November (live demo from the public URL once deploy succeeds).

## Retrospective
To be filled after the Sprint Review. Carried agreements from earlier slips:
keep PRs small and reviewed, prefer a working deployed MVP over extra features,
and do not block the whole team on one owner when the deadline is close.
