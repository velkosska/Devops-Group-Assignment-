#!/usr/bin/env bash
# Creates (or resets) one contained database user per service on the Azure SQL databases.
# Run in Azure Cloud Shell after infra/sql.bicep is deployed. Needs sqlcmd.
# Passwords come from environment variables; nothing secret is stored in this file.
# Generate a password with:  openssl rand -base64 24 | tr -d '/+=' ; echo 'Aa1!'
# Passwords must not contain single quotes.
#
# Required environment variables:
#   SQL_ADMIN_PASSWORD        admin password of the SQL server
#   APPLICATIONS_DB_PASSWORD  password for applications_user
#   INSIGHTS_DB_PASSWORD      password for insights_user
set -euo pipefail

PREFIX="${PREFIX:-sdd-3b-g4}"
SQL_HOST="${PREFIX}-sql.database.windows.net"
SQL_ADMIN="${SQL_ADMIN:-sqladmin}"

: "${SQL_ADMIN_PASSWORD:?Set SQL_ADMIN_PASSWORD}"
: "${APPLICATIONS_DB_PASSWORD:?Set APPLICATIONS_DB_PASSWORD}"
: "${INSIGHTS_DB_PASSWORD:?Set INSIGHTS_DB_PASSWORD}"

create_user() {
  local database="$1" user="$2" password="$3"
  sqlcmd -S "$SQL_HOST" -d "$database" -U "$SQL_ADMIN" -P "$SQL_ADMIN_PASSWORD" -b -Q "
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '${user}')
    CREATE USER [${user}] WITH PASSWORD = '${password}';
ELSE
    ALTER USER [${user}] WITH PASSWORD = '${password}';
ALTER ROLE db_ddladmin ADD MEMBER [${user}];
ALTER ROLE db_datareader ADD MEMBER [${user}];
ALTER ROLE db_datawriter ADD MEMBER [${user}];"
  echo "OK: ${user} in ${database}"
}

create_user "${PREFIX}-api-db" applications_user "$APPLICATIONS_DB_PASSWORD"
create_user "${PREFIX}-insights-db" insights_user "$INSIGHTS_DB_PASSWORD"
