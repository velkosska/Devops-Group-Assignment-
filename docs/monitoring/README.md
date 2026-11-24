# Request monitoring and SLO

Both FastAPI services write one JSON record per request to stdout at the default
INFO level. Each contains `method`, `path`, `status`, and `duration_ms`. The
configured Container Apps environment in `infra/main.bicep` sends console logs
to the `sdd-3b-g4-logs` Log Analytics workspace.

## Workspace schema and verification

These are query templates. The infrastructure selects the direct Log Analytics
destination, for which Microsoft documents `ContainerAppConsoleLogs_CL` with
`TimeGenerated`, `ContainerAppName_s`, and `Log_s`. The actual workspace and
its ingested records still require verification. If the environment instead uses
Azure Monitor resource-specific diagnostics, map the header to
`ContainerAppConsoleLogs`, `ContainerAppName`, and `Log` after checking Tables.
[Microsoft Container Apps logging schema](https://learn.microsoft.com/azure/container-apps/log-monitoring)

1. Open the group's workspace under **Logs**. In **Tables**, find the console
   table and inspect a few rows for the two deployed Container App names.
2. Generate one successful health request and one safe unknown-route request on
   each app. Record the UTC time, method, path, and received status.
3. Paste [request-logs.kql](request-logs.kql) and append
   `RequestLogs(30m) | order by TimeGenerated desc | take 30`. Check the recorded
   unknown-route requests, app names, statuses and non-negative durations. The
   shared helper excludes `/health` so liveness probes do not skew dashboard
   metrics. Check health requests separately in the raw table. If the deployment
   uses different names, edit the query parameters and confirm the SLO filter.
4. For each report below, paste the shared query header followed by that report.
   Use **Save as query** and share it with the workspace/team if permitted.
   Replace the header in existing saved dashboard queries with the updated
   version and save them again. Use the saved queries as the dashboard. For the review, show request count,
   error rate and p95 by service. Empty buckets indicate no observed requests.

| Saved query | What to show |
| --- | --- |
| [Request health by service](dashboard.kql) | Five-minute counts, HTTP error and 5xx rates, average, p50 and p95 |
| [Service request totals](service-summary.kql) | Daily counts by app, failed requests, and p50/p95/p99 distribution |
| [Slow and failing endpoints](endpoints.kql) | Endpoint p95 and HTTP/5xx totals for the slowest paths |
| [Board API latency SLO](slo.kql) | Eligible requests, successes below the latency limit, score and target |

A request counts as an HTTP error at status 400–599 and a server error at
500–599. Each error rate divides by all valid request records in that group.
Service totals can be added for a workspace-wide request count.

## Service level objective

Over a rolling seven-day window, at least **99%** of logged
`GET /applications` requests on `sdd-3b-g4-api` should return **2xx in under
400 ms**. All parseable request records for that endpoint are eligible, so
observed HTTP failures count against the objective. The query measures
application handling time. It cannot measure ingress failures that occur before
the request reaches the app or time spent in front of the app.

Zero eligible requests produce **No data**. Use the first and last observed
request timestamps alongside the deployment and ingestion start times to report
the verified observation window. If fewer than seven days are available, label
the score provisional and state the actual period. A full-window alert or
claim requires confirmation that the workspace collected data over that window.

## Evidence status

- Local verification confirmed structured request logging to stdout with method,
  path, status and duration. Existing tests also verify CORS and logging.
- The available Azure CLI session required sign-in. No workspace query, saved
  query, dashboard link, screenshot, or measured SLO result was obtained.
- Record the workspace link, actual table and column names, UTC verification
  timestamps, saved query links and measured results here after deployment.
- The SLO requires the Applications API list route to be deployed and exercised.

## Partial-failure rehearsal

After the board, event sender and Compose configuration are integrated, use a
disposable local stack for the failure demo. Create a test application, move it
to Interview and Rejected, then compare the dashboard with the known sequence.
Both stages should appear in the historical funnel. Stop only the local Insights
container. Confirm a board update still succeeds, event delivery finishes or
times out within the sender's two-second budget, and the UI shows a clear
Insights error after its timeout. Restart Insights and submit another transition.
Verify new events arrive and earlier committed events remain readable.

The proposal's MVP accepts that an event may be missed while the sender cannot
reach Insights. If the sender adds retries, it must reuse the same event UUID.
Proof of this end-to-end behavior depends on the Applications API sender and UI.
