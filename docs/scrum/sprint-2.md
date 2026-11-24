# Sprint 2 (19–24 November)

## Roles
- Product Owner: Aakriti (`adh-aakriti`)
- Scrum Master: Aakriti (`adh-aakriti`)
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
Interim retrospective written on 24 November from the sprint record; it will be
updated after the Sprint Review.

**What went well**
- The Sprint 1 agreements worked: 60+ small pull requests from all five members,
  most of them reviewed and approved.
- Infrastructure as code paid off: when Azure suspended the Container Apps
  environment on 23 November, we recreated it from Bicep.
- Every merge to `main` deploys and runs an end-to-end smoke test on the live
  services (19 of 19 CD runs green).

**What did not go well**
- Everything was built in five days, so the stretch goals with the most credit
  (blue-green deploys, outbox) were not reached, while drag and drop was.
- Nine pull requests were merged without an approving review (seven before the
  `protect-main` ruleset existed, plus #31 and #35), and CI
  was not a required check on `main`.
- Monitoring evidence depended on the one member with workspace access.
- The Product Owner and Scrum Master were the same person in every sprint.

**What we agree to change**
- Make green CI a required status check on `main`.
- Give at least two members access to the Log Analytics workspace.
- Split the Product Owner and Scrum Master roles between two people.
