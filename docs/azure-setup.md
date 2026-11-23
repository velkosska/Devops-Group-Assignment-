# Reproducing the Azure setup

Everything below runs in Azure Cloud Shell (Bash) with Contributor on `rg-sdd-3b-g4`.
All resources are defined in `infra/` (Bicep). No password is ever written to a file or to the repository.

| Setting | Value |
| --- | --- |
| Directory (tenant) | IE Instituto de Empresa, S.L. (`5ca2bc70-353c-4d1f-b7d7-7f2b2259df68`) |
| Subscription | Azure Simple IE Instituto de Empresa, S.L. |
| Resource group | `rg-sdd-3b-g4` (westeurope, created by the professor) |
| Prefix | `sdd-3b-g4` |

## 0. Get the code

```bash
az account show --query name -o tsv   # must be the IE subscription
git clone https://github.com/velkosska/Devops-Group-Assignment-.git
cd Devops-Group-Assignment-
```

Before each deploy, preview it with `az deployment group what-if` (same arguments as `create`).

## 1. Log Analytics workspace and Container Apps environment

```bash
az deployment group create -g rg-sdd-3b-g4 -f infra/main.bicep --name foundation
```

## 2. SQL server and the two serverless databases

```bash
export SQL_ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')Aa1!"
az deployment group create -g rg-sdd-3b-g4 -f infra/sql.bicep --name sql \
  -p sqlAdminPassword="$SQL_ADMIN_PASSWORD"
```

Serverless, 0.5 to 1 vCore, 15-minute auto-pause, 2 GB. The firewall allows Azure services only.

## 3. Static Web App for the UI

```bash
az deployment group create -g rg-sdd-3b-g4 -f infra/swa.bicep --name swa
```

Its address is the only origin both services allow (CORS). CD builds the UI and uploads it here on every merge to main, using a deployment token it reads from Azure at deploy time.

## 4. One database user per service

```bash
# sqlcmd is not preinstalled in Cloud Shell
mkdir -p ~/bin && curl -sL https://github.com/microsoft/go-sqlcmd/releases/latest/download/sqlcmd-linux-amd64.tar.bz2 | tar xj -C ~/bin
export PATH="$HOME/bin:$PATH"

export APPLICATIONS_DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')Aa1!"
export INSIGHTS_DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')Aa1!"
./infra/create-db-users.sh
```

`applications_user` can only reach `sdd-3b-g4-api-db`, and `insights_user` only `sdd-3b-g4-insights-db`. If the script fails with error 40613, a database is resuming from auto-pause: wait a minute and run it again (it is safe to repeat). Running it again later resets the passwords, which is how they are rotated.

## 5. The two Container Apps

The images come from GHCR, pushed by the CD workflow on main (`ghcr.io/velkosska/<service>:<commit sha>`, public packages).

```bash
export INSIGHTS_API_KEY="$(openssl rand -hex 32)"
SHA=<commit sha of an image pushed by CD>
SQL_HOST=sdd-3b-g4-sql.database.windows.net
DRIVER="driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes"

az deployment group create -g rg-sdd-3b-g4 -f infra/containerapps.bicep --name containerapps \
  -p applicationsImage="ghcr.io/velkosska/applications-api:$SHA" \
     insightsImage="ghcr.io/velkosska/insights-api:$SHA" \
     applicationsDbUrl="mssql+pyodbc://applications_user:${APPLICATIONS_DB_PASSWORD}@${SQL_HOST}:1433/sdd-3b-g4-api-db?${DRIVER}" \
     insightsDbUrl="mssql+pyodbc://insights_user:${INSIGHTS_DB_PASSWORD}@${SQL_HOST}:1433/sdd-3b-g4-insights-db?${DRIVER}" \
     insightsApiKey="$INSIGHTS_API_KEY"
```

The database URLs and the API key are stored only as Container App secrets. CD only changes the image, so it never needs them. To redeploy this file later, run step 4 again first to set new passwords.

## 6. Pipeline identity (OIDC, no password)

The managed identity `sdd-3b-g4-github` (Contributor on the resource group) was created by the professor. It trusts only runs on `main` of this repository:

```bash
az identity federated-credential create --name github-main \
  --identity-name sdd-3b-g4-github --resource-group rg-sdd-3b-g4 \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:velkosska/Devops-Group-Assignment-:ref:refs/heads/main" \
  --audiences api://AzureADTokenExchange
```

GitHub may send the subject with numeric account and repository IDs instead of names, so a second rule trusts that form too (still only main of this repository):

```bash
az identity federated-credential create --name github-main-ids \
  --identity-name sdd-3b-g4-github --resource-group rg-sdd-3b-g4 \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:velkosska@139571183/Devops-Group-Assignment-@1463422952:ref:refs/heads/main" \
  --audiences api://AzureADTokenExchange
```

GitHub repository secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`. Repository variables: `PREFIX`, `RESOURCE_GROUP`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Error 40613, "database is not currently available" | The serverless database is resuming from auto-pause. Wait about a minute and retry. |
| Container App stays "InProgress"; `revision list` says `ManagedClusterSuspended` | Azure suspended the environment's compute. On 23 November we deleted and recreated `sdd-3b-g4-env` with step 1. |
| CD fails at "Sign in to Azure" with "AADSTS700213: No matching federated identity record" | The subject GitHub sent does not match any federated credential. The error shows the subject it sent; add a credential with exactly that subject (see step 6). |
