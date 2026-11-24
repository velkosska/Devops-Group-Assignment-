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
| Production log ingestion | Verified on 24 November with workspace access: JSON request lines from both apps arrive in `ContainerAppConsoleLogs_CL`. |
| Dashboard measurements and saved queries | Run at about 19:15 UTC over the last 24 h, `/health` probes excluded. applications-api: 22 requests, 3 HTTP errors (13.64%, expected 404s from the CD smoke test checking that a deleted application is gone), 0 server errors, average 75.17 ms, p50 34.21 ms, p95 247.69 ms, p99 282.08 ms. insights-api: 21 requests, 0 HTTP errors, 0 server errors, average 15.95 ms, p50 13.73 ms, p95 34.81 ms, p99 35.6 ms. Saved in the workspace as the legacy queries "Service request totals" and "Board API latency SLO" (Logs, Queries hub, Other). |
| Seven-day board SLO | At target: 21 of 21 eligible `GET /applications` requests returned 2xx in under 400 ms (100% against the 99% target). Observation window 23 November 15:43 to 24 November 18:59 UTC, shorter than seven days and a small sample, part of it from CD smoke tests. |

Who verified what: Khadeja (`digaaaa`) checked the CD run and the public health
endpoints, but her Azure identity has no access to the IE subscription that holds
`rg-sdd-3b-g4`. Aakriti (`adh-aakriti`), who has Contributor on the resource
group, then ran the queries in `sdd-3b-g4-logs`, saved two of them in the
workspace and measured the numbers above. Screenshots of the query results are
attached to the comments of PR #65.

### Limits we report honestly

- There is no Azure Workbook. The dashboard is the set of saved Log Analytics
  queries listed above; a Workbook was planned in the proposal but not built.
- No alert rules exist yet (for example on the SLO or on the 5xx rate).
- The SLO sample is about one day and 21 requests, most of them from the CD smoke
  test, so the 100% score is provisional, not a seven-day result.

## Re-running the evidence queries

Anyone with access to the workspace can repeat this from **sdd-3b-g4-logs > Logs**
in the Azure portal. First confirm the table and three columns named above. To verify
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

The failure path is implemented and tested: applications-api sends events with a
two-second timeout and never fails the board write
(`applications-api/tests/test_insights_http_errors.py`), and the UI shows
"Insights are temporarily unavailable" after a three-second timeout and one retry.
It was rehearsed on a local Compose stack (see
[insights-event-delivery.md](../insights-event-delivery.md)): with insights-api
stopped, a stage move still returned 200 in 2.59 s, and delivery resumed after a
restart. Events sent while insights-api was down are lost, because delivery is
best effort (decision record 6).

To repeat it locally: `docker compose up --build`, run the UI with
`npm run dev`, then `docker compose stop insights-api`, move a card, and open
Insights. `docker compose start insights-api` brings it back.
