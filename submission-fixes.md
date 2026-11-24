# Proposed fixes before the `submission` tag

Repo: `velkosska/Devops-Group-Assignment-` · main at `33c8497` · deadline 24 Nov, 23:59 CET

## Be realistic about the score

- Today's estimate is about **71/100**.
- Doing everything below honestly gets you to about **78–81**.
- **90 is not reachable tonight.** The biggest losses are already in the history and can't be undone:
  - Sprints 0 and 1 delivered nothing, and there was no Sprint 1 Review.
  - The same person was Product Owner and Scrum Master in every sprint.
  - 9 PRs were merged without approval.
  - Blue-green and release tags were promised but not built.
- Faking that history (back-dated retros, invented reviews) would cost more than it gains if the grader notices. The fixes below are the honest, fast ones, in order of points per minute.

## Time plan (from about 23:00)

| By | Do |
|---|---|
| 23:10 | P0 settings and the short team retro call |
| 23:30 | P1 doc PR opened, reviewed and merged |
| 23:40 | P2 code PR merged and CD green, **or skip it** |
| **23:45** | **Tag `submission` no matter what (P3)** |

---

## P0: GitHub settings and team actions (no code, about 10 min)

### 1. Make green CI a required check on `main` (DevOps and Scrum, about +0.5)
- **What:** Settings → Rules → `protect-main` → add "Require status checks to pass". Select `test (applications-api)`, `test (insights-api)`, `test (ui)`, `secret scan (gitleaks)` and the two `build image` jobs.
- **Why:** The Definition of Done and the proposal both say green CI is required, but the ruleset doesn't enforce it.
- **Afterwards:** In `docs/decisions.md` §3, change "Branch protection: PR + review required" to "PR, 1 approval and green CI required (ruleset `protect-main`)".

### 2. Hold a real 10-minute retro call tonight (Scrum, about +1)
- Everyone joins. Answer three questions:
  1. Why did Sprints 0 and 1 slip?
  2. What worked in Sprint 2?
  3. What do we change?
- The Scrum Master writes the answers into the sprint files (P1, item 6). It must be your real discussion, dated honestly ("held 24 Nov, after the fact").

### 3. Clean up the issues (Scrum, about +0.5)
- On each of the 11 closed issues, tick the acceptance criteria that are actually met and assign the owner.
- Optionally, add a Sprint field on the Project board.

### 4. Optional: create a monitoring alert (Monitoring, about +0.5)
- **Who:** Aakriti, who has workspace access.
- **What:** In the Azure portal, create one Log Analytics alert rule on the 5xx count or the SLO query, with no action group needed.
- **Disclose:** It's a manual portal change, not in Bicep, so say so in `docs/monitoring/README.md`.
- **Skip** the Azure Workbook. It isn't worth the time tonight.

---

## P1: Documentation PR (zero deploy risk, about 20 min)

Branch `docs/submission-fixes`, one PR, one reviewer.

### 5. Clean up `docs/monitoring/README.md` (Monitoring, about +1)
- **Delete** the paragraph that starts "The native Azure CLI was signed in…" and ends "No Log Analytics query could be executed with this identity". It contradicts the measured results right above it.
- **Replace it** with: Khadeja checked CD and the public health endpoints, but her identity has no access to the IE subscription. Aakriti, who has Contributor, ran the queries, saved two of them, and measured the numbers above.
- **Add a "Limits" list:**
  - There is no Azure Workbook; the dashboard is the saved queries.
  - No alert rules exist (or one, if you did item 4).
  - The SLO covers about 1 day and 21 requests, mostly CD smoke tests, so it's provisional.
- **Rename** "Capture the remaining evidence" to "Re-running the evidence queries", and fix `sdd-3b-g4-logs ? Logs` to `sdd-3b-g4-logs > Logs`.
- **Rewrite "Partial-failure rehearsal"** in the past tense, as already done. It was rehearsed locally: the stage move still returned 200 in 2.59 s, and delivery resumed after a restart. Drop "After the board… are integrated".
- **Commit the PR #65 screenshots** into `docs/monitoring/evidence/` (service totals, SLO, raw logs table) with a short README.

### 6. Write up the sprint retros (Scrum and Docs, about +1)
- **`sprint-0.md` and `sprint-1.md`:** replace the `TODO` lines with what you said on tonight's call. Typical honest points:
  - No idea was agreed until 18 Nov.
  - One person held both Scrum roles.
  - There was no shared backlog, so nobody could start.
- **`sprint-2.md`:**
  - Move "Done later in the sprint" into "Done".
  - Add a Retrospective section from tonight's call.
  - Keep "Sprint Review: 25–26 Nov, in class".
  - State openly that the PO and SM were the same person in every sprint, and why.

### 7. Add the two missing decision records to `docs/decisions.md` (Docs, about +1)
The proposal promised six records. Number these 6 and 7:

- **6. Event delivery: best-effort push now, outbox later, no broker.**
  - *Decision:* After its commit, applications-api sends `POST /events` with a UUID `event_id`, an `X-API-Key` and a 2-second timeout. Failures are logged and the board still succeeds. Insights intake is idempotent on `event_id` (409 if the same id comes with different data). No retry.
  - *Alternatives:* a transactional outbox (stretch, not built); a broker (out of scope in the brief); insights reading the applications database (breaks database-per-service); synchronous both-or-nothing writes (couples the board to analytics).
  - *Consequences:* Analytics are eventually consistent and can miss events while insights is down. Board writes take up to about 2 s longer during an outage (2.59 s measured). The CD smoke test proves on every deploy that the event crosses between the services.
- **7. Cold starts: scale to zero and serverless auto-pause.**
  - *Decision:* Keep min 0 replicas and auto-pause. Cover the worst case with the 90 s database retry, the 3.5 min startup probe, the 5 min CD health loop, and the 3 s UI timeout with one retry. `/health` doesn't touch the database.
  - *Alternatives:* min 1 replica (cost, and against the brief); a keep-warm ping (hides real behaviour).
  - *Consequences:* The first request after a quiet period can take 30 s to 2 min or return 503. Pre-warm before the demo. Cold starts count against the SLO and are reported, not filtered out.

### 8. Add a "Delivered vs proposed" table to `README.md` (Docs, about +0.5, and protects other categories)
Put it before "Documentation". One row per proposal item, with its status and where it is or why it's missing.

| Status | Items |
|---|---|
| Delivered | CRUD and board, analytics, drag and drop, partial-failure banners, full CI, CD with health gate, end-to-end smoke test, Bicep |
| Delivered, best effort | Stage events |
| Delivered, provisional | SLO |
| Not built | Blue-green, outbox, Workbook |
| Not in CI | SQL Server integration tests |
| Only `submission` | Release tags |

Stating the gaps yourselves reads as honest. A grader finding them reads as overclaiming.

### 9. Small accuracy fixes
- **`AI_USAGE.md`:**
  - Update Khadeja's 24 Nov row ("Workspace measurements remain pending" → "measured by Aakriti, see PR #65").
  - Add a row for tonight's docs and fixes. The Definition of Done requires it.
- **`.mailmap`:** add these two lines so Khadeja and Edard aren't split in `git shortlog`:
  ```
  Khadeja <knehad.ieu2024@student.ie.edu> digaaaa <knehad.ieu2024@student.ie.edu>
  Edard Hala <ehala.ieu2024@student.ie.edu> edardhala <ehala.ieu2024@student.ie.edu>
  ```
- **`docs/insights-api.md`:** the last paragraph still says the legacy `POST /analytics/*` routes "can coexist". Update it if you do P2, otherwise leave it.

---

## P2: Code PR (Product, about +1 to 1.5). Only if it's merged and CD is green by 23:40

All three changes are small and come with tests. A red CD at 23:50 is worse than not doing them. **If in doubt, skip P2 and list these under "Disclose" instead.**

### 10. Remove the legacy unauthenticated `POST /analytics/*` routes (insights-api)
- **What:** Delete `insights-api/app/routes/analytics.py` and `tests/test_analytics_api.py`, and remove the router from `app/main.py`.
- **Why:** They're live in production with no API key, the UI never calls them, and they duplicate `/funnel`, `/time-in-stage` and `/stale`.

### 11. Implement `GET /timeline/{application_id}` (insights-api)
- **Why:** The UI's detail drawer already calls it. Today it gets a 404 and silently hides the History section. This was stretch #5 in the proposal.
- **What:**
  - Add `read_application_events(session, application_id)` to `repositories/events.py`.
  - The route returns `{application_id, events: [{from_stage, to_stage, occurred_at}]}`, oldest first.
  - It returns 404 for an unknown or deleted application and 503 when storage is unavailable.
- **Tests:** route contract, 404 cases, 503, 422 on a bad id, and the repository against SQLite.

### 12. Return a clear 503 when the database fails mid-request (applications-api)
- **What:** Add an exception handler for `SQLAlchemyError` in `app/main.py` that returns 503 `{"detail": "The database is temporarily unavailable"}` and logs the exception type only.
- **Why:** Today it's a plain-text 500, against the Definition of Done's "never a stack trace".
- **Test:** monkeypatch the repository to raise `OperationalError`, then expect 503 and no leaked detail.

Do **not** touch `cd.yml` tonight.

---

## P3: The `submission` tag (DevOps, required deliverable). Run at 23:45 at the latest

Wait until the last PR you're including is merged and CD is green (or skip the PR), then:

```bash
git checkout main && git pull
```

```bash
git tag -a submission -m "Final submission, group sdd-3b-g4"
```

```bash
git push origin submission
```

Post the tag's commit SHA (`git rev-parse submission`) and the UI URL on Blackboard.

Don't create back-dated `v0.1.0` or `v0.2.0` tags. That would look reconstructed.

---

## Won't fix tonight: disclose in the README table and in the demo

- No blue-green deploys and no automated rollback.
- No outbox, so events can be lost while insights is down.
- No Azure Workbook. The SLO window is about 1 day.
- SQL Server integration tests don't run in CI.
- Sprints 0 and 1 slipped completely, and the PO and SM were the same person in every sprint.
- 9 PRs were merged without approval. Seven came before the ruleset existed; be ready to explain #31 and #35, which came after.
- The board API has no user authentication (single-user demo by design), and `/docs` is public.
- The SQL firewall allows all Azure services. The Bicep is 4 unlinked files, and the pipeline identity isn't in the Bicep.

## Before the Sprint Review (25–26 Nov)

- Pre-warm both APIs about 5 minutes before you present, since a cold start takes about 30 s or more.
- Rehearse the failure demo locally: `docker compose stop insights-api`, then move a card and show the banner.
- Have a recorded CD run ready as a backup.
- Make sure every member can explain one area outside their own.
