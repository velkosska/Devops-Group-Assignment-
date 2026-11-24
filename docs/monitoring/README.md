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
   version and save them again. Use the saved queries as the dashboard. Show
   request count, error rate and p95 by service at the review. Empty buckets
   indicate no observed requests.

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

## Production evidence on 24 November 2026

| Check | Result |
| --- | --- |
| Deployment of commit `c666c1a` | GitHub Actions CD completed successfully at 15:58 UTC. [Deployment run](https://github.com/velkosska/Devops-Group-Assignment-/actions/runs/45430809682) |
| Applications API and Insights API | Both public `GET /health` endpoints returned HTTP 200 and `{"status":"ok"}` at 17:11 UTC using the URLs in the [root README](../../README.md#live-url). |
| Production log ingestion | A teammate reported that logs from both apps arrived and that the queries ran. Raw workspace rows and query results were unavailable to the author of this evidence. |
| Dashboard measurements and saved queries | Pending authorized workspace verification. Request count, error rate, latency and failed-request totals are unavailable. Saved query location is unverified. |
| Seven-day board SLO | Pending authorized workspace verification. Eligible count, good count, score and observation window are unavailable. |

The deployment guide identifies the subscription as Azure Simple IE Instituto
de Empresa, S.L., the resource group as `rg-sdd-3b-g4` in West Europe, and the
apps as `sdd-3b-g4-api` and `sdd-3b-g4-insights`. The Bicep configuration
selects `sdd-3b-g4-logs`. The expected direct-ingestion schema is
`ContainerAppConsoleLogs_CL` with `TimeGenerated`, `ContainerAppName_s`, and
`Log_s`. These resource and schema details come from the repository and
Microsoft's documentation. The public health check verifies service reachability.

The native Azure CLI was signed in. The default Azure for Students subscription
returned `ResourceGroupNotFound`. The only other visible subscription, IE
Workspaces, returned `AuthorizationFailed` for both
`Microsoft.Resources/subscriptions/resourcegroups/read` and
`Microsoft.OperationalInsights/workspaces/read`. Refreshing the subscription
list did not reveal the documented deployment subscription. No Log Analytics
query could be executed with this identity.

## Capture the remaining evidence

A teammate with access can complete this from **sdd-3b-g4-logs ? Logs** in the
Azure portal. First confirm the table and three columns named above. To verify
ingestion and see the timestamps available for each app, run this against the
raw log table after confirming its schema.

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated >= ago(7d)
| where ContainerAppName_s in ("sdd-3b-g4-api", "sdd-3b-g4-insights")
| extend r = parse_json(Log_s)
| where isnotempty(tostring(r.method)) and isnotempty(tostring(r.path))
      and isnotnull(toint(r.status)) and isnotnull(todouble(r.duration_ms))
| summarize Requests = count(), HealthRequests = countif(tostring(r.path) == "/health"),
            FirstSeenUtc = min(TimeGenerated), LastSeenUtc = max(TimeGenerated)
         by Service = ContainerAppName_s
```

Run the four reports listed above with the shared header prepended and the
portal time picker set to **Set in query**. For dashboard evidence, export the
per-service results from **Service request totals** and the five-minute series
from **Request health by service**. The totals include HTTP and 5xx counts and
rates, average latency, and p95. Use **Slow and failing endpoints** to inspect
endpoint-level breakouts. The dashboard intentionally excludes `/health`.

Save or update the dashboard reports in an existing team query pack or as
workspace-scoped legacy saved queries if the group has access only to the
workspace. Open the saved queries again and confirm they return real results.
Provide the workspace or query-pack link, saved query names, and a UTC timestamp.
[Microsoft Learn guide to saving queries](https://learn.microsoft.com/azure/azure-monitor/logs/save-query)

Export the SLO row with the UTC execution time, eligible and good counts, the
score, and first and last observed timestamps. The query's denominator is all
eligible logged `GET /applications` requests. Its numerator requires both
2xx and latency strictly under 400 ms. Check the ingestion start independently
of the first eligible request. If coverage is shorter than seven days, report a
provisional score and its observed period. If the result is **No data**, record
that instead of treating it as a pass.

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
