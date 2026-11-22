# Applications event delivery

Applications sends `POST /events` to `INSIGHTS_URL` after committing creation, a
stage move, or deletion. Detail edits do not emit stage events. Both services use
the same `INSIGHTS_API_KEY`. Set the key as a secret, and set the destination to
the team's Insights endpoint. The per-operation HTTP timeout is configured with
`INSIGHTS_TIMEOUT_SECONDS` and defaults to two seconds.

When Insights is unreachable or returns an unexpected status, Applications
logs a warning and keeps the board operation successful. The warning omits the
request payload, URL, API key, and response body. Delivery is best effort. A
failed notification is not retried and historical analytics can have gaps.
The next successful stage change resumes delivery. An outbox is future work.

The default CORS policy remains restricted to the UI origin. The API key is
shared only by the backend services and should never be passed to the browser.

## Local integration evidence

Two Docker containers ran the Applications sender and Insights analytics against
separate databases on a disposable SQL Server 2022 instance. Create and stage
moves produced persisted history. A rejected application still counted in
Interview, completed visits produced durations, and a seeded 20-day-old
event appeared in the stale response. With Insights stopped, the board
committed a stage change and returned 200 in 2.59 seconds. After
Insights restarted, delivery resumed, earlier history remained available, and
deleting an application removed it from the funnel.
