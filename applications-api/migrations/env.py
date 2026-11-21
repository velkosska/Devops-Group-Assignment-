"""Alembic environment.

Three ways to run, all through the same migration files:

- On service startup: `app.db.run_migrations` passes an open connection in
  `config.attributes["connection"]`.
- From the command line (`alembic upgrade head`): the URL comes from
  APPLICATIONS_DB_URL via `app.config`.
- Offline (`--sql`): the caller passes `config.attributes["url"]`; no database
  is needed. Tests use this to check the SQL generated for SQL Server.

The URL is never written to alembic.ini and never logged.
"""

from alembic import context
from sqlalchemy import create_engine, pool

from app.config import get_settings

config = context.config

# Migrations are written by hand with op.*, so there is no model metadata.
target_metadata = None


def _database_url() -> str:
    url = config.attributes.get("url")
    if url:
        return url
    secret = get_settings().applications_db_url
    if secret is None:
        raise RuntimeError("APPLICATIONS_DB_URL is not set")
    return secret.get_secret_value()


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = create_engine(_database_url(), poolclass=pool.NullPool)
    with engine.connect() as new_connection:
        context.configure(connection=new_connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
