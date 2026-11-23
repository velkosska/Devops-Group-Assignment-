# Job Application Tracker

A kanban board for job applications (Applied, Phone screen, Interview, Offer, Rejected) plus a
pipeline-analytics dashboard that shows where applications drop off and which have gone quiet.

Built as a Scrum team project for the DevOps course: two containerised services, each with its
own Azure SQL serverless database, behind a static React UI, deployed to Azure by GitHub Actions.

> Deployed on Azure. Every merge to `main` runs CI, pushes images to GHCR, updates
> the Container Apps, checks `/health`, and uploads the UI to Static Web Apps.

## Live URL

| What | URL |
| --- | --- |
| UI (Static Web App) | https://lively-river-09befa003.4.azurestaticapps.net |
| applications-api | https://sdd-3b-g4-api.redpebble-0dcf8de4.westeurope.azurecontainerapps.io |
| insights-api | https://sdd-3b-g4-insights.redpebble-0dcf8de4.westeurope.azurecontainerapps.io |

Useful paths: `/health` on both APIs, `/applications` on applications-api. The API
root (`/`) returns `{"detail":"Not Found"}` — that is normal; these are APIs, not
sites.

**Cold starts:** Container Apps scale to zero and Azure SQL serverless auto-pauses.
After roughly 15 minutes with no traffic, the first request can take 1–2 minutes or
return a 503 / time out. Wait a minute and refresh; the next requests are fast.

## Architecture

```text
Browser
   │
   ├─ HTTPS ──► Static Web App (React UI)
   │                 │
   │                 ├─ /applications… ──► applications-api (Container App) ──► Azure SQL (applications)
   │                 │
   │                 └─ /funnel…        ──► insights-api (Container App)     ──► Azure SQL (insights)
   │
   └─ applications-api also POSTs stage events to insights-api (X-API-Key)

Logs from both Container Apps go to the shared Log Analytics workspace.
```

Resource group `rg-sdd-3b-g4` (westeurope), prefix `sdd-3b-g4`. See
[docs/azure-setup.md](docs/azure-setup.md) and [docs/decisions.md](docs/decisions.md).

## Run locally

Needs Docker Desktop (or another Docker Engine with Compose v2). From a clean clone:

```bash
docker compose up --build
```

No `.env` file is required: `docker-compose.yml` ships local-only defaults. To override
values, copy `.env.example` to `.env` (gitignored). Those defaults are for local use only;
Azure uses secrets.

| Service | URL |
| --- | --- |
| applications-api | http://127.0.0.1:8000/health |
| insights-api | http://127.0.0.1:8001/health |

Both services apply Alembic migrations on startup against the SQL Server container. Stop with
`Ctrl+C`, or `docker compose down` (add `-v` to drop the SQL Server volume).

**Apple Silicon:** SQL Server only ships for `linux/amd64`. In Docker Desktop enable
"Use Rosetta for x86_64/amd64 emulation" and give Docker at least 4 GB of memory.

The UI can be run on its own: `cd ui && npm ci && npm run dev`. Without API URLs it uses
in-browser sample data. See [ui/README.md](ui/README.md).

## Run the tests

From each service directory, with Python 3.12 and its `requirements-dev.txt` installed:

```bash
cd applications-api && pytest
cd ../insights-api && pytest
```

From `ui/`:

```bash
cd ui && npm ci && npm test
```

CI also runs ruff, black, a 70% coverage gate on `app/domain`, bandit and pip-audit for both
services, plus eslint, prettier, typecheck, vitest and a production build for the UI.

## Reproduce the Azure setup

All Azure resources are defined as Bicep in `infra/` and deployed from Azure Cloud Shell, in the resource
group `rg-sdd-3b-g4` (westeurope). The step-by-step guide, with every command and no passwords, is in
[docs/azure-setup.md](docs/azure-setup.md).

After that one-time setup, only the pipeline changes anything: every merge to `main` runs CI, pushes
both images to GHCR tagged with the commit SHA, and deploys them to the Container Apps, then builds the UI against them and uploads it to the Static Web App.

## Documentation

- [Project proposal](docs/proposal.md)
- [Decision records](docs/decisions.md)
- [Data model](docs/data-model.md)
- [Database migrations](docs/database-migrations.md)
- [Azure setup](docs/azure-setup.md)
- [Insights API](docs/insights-api.md)
- [Monitoring](docs/monitoring/README.md)
- Scrum: [Definition of Done](docs/scrum/definition-of-done.md),
  [Sprint 0](docs/scrum/sprint-0.md),
  [Sprint 1](docs/scrum/sprint-1.md),
  [Sprint 2](docs/scrum/sprint-2.md)
- [AI usage](AI_USAGE.md)

## Team

| Member | GitHub username |
| --- | --- |
| Marija Velkoska | [velkosska](https://github.com/velkosska) |
| Aakriti Adhikari | [adh-aakriti](https://github.com/adh-aakriti) |
| Alejandro Serrano | [alejandroserranosanchez](https://github.com/alejandroserranosanchez) |
| Khadeja | [digaaaa](https://github.com/digaaaa) |
| Edard | [edardhala](https://github.com/edardhala) |
