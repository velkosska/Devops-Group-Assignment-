# Database and migrations pattern

How a service talks to its own database and changes its schema. It is written for
`applications-api`, and `insights-api` follows the same pattern for its own database.
Each service has its own database and never reads the other's.

## How it works

1. The service starts and reads `APPLICATIONS_DB_URL` (a secret) from the environment.
2. `app/db.py` waits for the database to accept a connection. Azure SQL serverless pauses
   when idle and can take about a minute to resume, so it retries with a growing delay
   (1 s, 2 s, 4 s, then 10 s at most) until `DB_CONNECT_MAX_WAIT_SECONDS` (default 90).
   If the database never answers, startup fails with a clear message and the container restarts.
3. If `RUN_MIGRATIONS_ON_STARTUP` is true (the default), every migration that has not been
   applied yet runs, in order. Running it again does nothing.
4. The service starts answering requests. `GET /health` does not touch the database.

## Layout

| Path | Purpose |
| --- | --- |
| `app/db.py` | Engine, connection retry, `run_migrations`, and the `get_session` dependency |
| `migrations/env.py` | Alembic setup. Reads the URL from settings, never from a file |
| `migrations/versions/` | One file per schema change, numbered `0001`, `0002`, ... |
| `alembic.ini` | Alembic settings. Contains no URL or credentials |

## Rules

- **Only `app/repositories/` runs SQL.** Routes and services never import SQLAlchemy.
  A repository receives a `Session` and returns plain values.
- **Get a session with `Depends(get_session)`** in a route, and pass it to the service,
  which passes it to the repository. Without a configured database it answers 503.
- **Never edit a migration that has been merged.** Add a new one. Deployed databases have
  already run the old one.
- **Write migrations by hand with `op.*`**, and write values out in full (do not import
  the `Stage` enum), so an old migration never changes when app code does.
- **Keep migrations portable** (plain SQLAlchemy types). The only SQL Server specific
  part is `DATETIMEOFFSET` for time-zone aware timestamps, set through a variant.
- **`updated_at` is not updated by the database.** The repository must set it on every edit.
- **Do not log the connection string or any credential.**

## Add a migration

From `applications-api/`, with `APPLICATIONS_DB_URL` pointing at a local database:

```bash
alembic revision -m "add notes table" --rev-id 0002
# edit migrations/versions/0002_add_notes_table.py (upgrade and downgrade)
alembic upgrade head
```

Then add a test in `tests/test_migrations.py` and update `docs/data-model.md`.

## Run the migrations by hand

```bash
alembic upgrade head     # apply
alembic current          # show the current version
alembic downgrade -1     # undo the last one (local databases only)
```

## Tests

- Migrations run against a temporary SQLite database, which is fast and needs no server.
- The SQL generated for SQL Server is produced offline (`--sql`) and checked for `IDENTITY`,
  `DATETIMEOFFSET` and the stage check constraint.
- Retry behaviour uses a fake clock, so tests take no real time.
- A test against a real SQL Server container runs in CI once docker-compose and the CI
  workflow exist.

## Not decided here

- The `applications` columns have maximum lengths (company and role 200, url 2048,
  location 200, salary range 100). The domain checks those limits, and the schemas
  call that check, so a too-long value is rejected before it reaches SQL.
