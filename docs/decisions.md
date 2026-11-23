# Decision records

## 1. Monitoring and reliability

### Context
The application uses two backend services: applications-api and insights-api. Both need consistent request logging so the team can monitor reliability in Azure.

### Decision
Both services will log HTTP requests as structured JSON to stdout.

Each request log will include:
- HTTP method
- Request path
- Response status code
- Request duration in milliseconds

Azure Log Analytics will be used to query these logs and monitor:
- Request count
- Error rate
- Response time

Use shared Log Analytics saved queries for the monitoring dashboard. The board API
SLO targets 99% of logged `GET /applications` requests returning 2xx in under
400 ms over seven days. The [monitoring guide](monitoring/README.md) contains the
queries and the steps for workspace verification.

### Alternatives Considered
- Plain-text logs: rejected because they are harder to query consistently.
- Separate logging formats for each service: rejected because they complicate dashboards and SLO calculations.

### Consequences
- Both services can use consistent monitoring queries.
- Production errors and slow requests are easier to identify.
- Monitoring depends on successful log ingestion into Azure Log Analytics.
- The dashboard and SLO must be verified after deployment.
- The SLO measures application handling time for observed requests. Ingress
  failures and waits before the app receives a request are outside this measure.

## 2. Deployment and pipeline

### Context
The brief requires deploying to Azure on every merge to main, only if CI passed, with images tagged by commit SHA, a post-deploy health check, scale to zero, no secrets in the repository, and nothing changed by hand after the initial setup. All of it runs in a shared IE subscription where we only have Contributor on our resource group.

### Decision
- Every Azure resource is defined in Bicep in `infra/` (environment and logs, SQL server and databases, Static Web App, Container Apps) and deployed once from Cloud Shell, previewed with `what-if` first. One contained database user per service is created by `infra/create-db-users.sh`. The steps are in [azure-setup.md](azure-setup.md).
- CI runs on every pull request and push. CD runs on main only: it calls CI and the Docker build on the same commit and only if both pass pushes both images to GHCR tagged with the commit SHA, then points both Container Apps at those images and retries `/health` for up to about 5 minutes per service, failing the run otherwise.
- The pipeline signs in as the managed identity `sdd-3b-g4-github` through OIDC, trusted only for runs on main of this repository. No Azure password exists anywhere.
- Database URLs and the shared API key are stored only as Container App secrets. CD only changes the image, so it never needs them.
- Container Apps scale from 0 to 1 replica. The startup probe allows about 3.5 minutes, so a paused database can resume and migrations can run.

### Alternatives Considered
- Azure CLI commands instead of Bicep: rejected, because Bicep is repeatable, can be previewed with `what-if`, and is credited by the brief.
- A service principal with a client secret: rejected, because a secret has to be stored and rotated; OIDC needs none.
- CD redeploying the Bicep on every merge: rejected, because it would need the database passwords as GitHub secrets.
- Azure Container Registry: rejected, because it has a fixed monthly cost; GHCR is free and the images contain no secrets, so they can be public.
- Blue-green deployment with revisions: not built, because it briefly runs two replicas while the brief caps us at one.

### Consequences
- The first request after a quiet period can take one to two minutes (container start plus database resume). The startup probe and the CD health check allow for it.
- Redeploying `infra/containerapps.bicep` needs the database passwords again, so the user script is run first to set new ones. This doubles as password rotation.
- On 23 November Azure suspended the Container Apps environment's compute. Because it was defined in Bicep, we deleted it and recreated it from the same Bicep file instead of rebuilding it by hand.
- The UI upload step can only be added to CD once the `ui/` folder exists.
