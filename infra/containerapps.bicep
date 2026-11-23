// The two Container Apps for group 4 of 3B, in the existing environment.
// Images come from GHCR (pushed by the CD workflow). Secrets are passed in at
// deploy time and stored only as Container App secrets, never in the repo.
@description('Prefix for every resource name.')
param prefix string = 'sdd-3b-g4'

@description('Azure region. Defaults to the resource group region (westeurope).')
param location string = resourceGroup().location

@description('Full image reference, e.g. ghcr.io/velkosska/applications-api:<commit sha>.')
param applicationsImage string

@description('Full image reference, e.g. ghcr.io/velkosska/insights-api:<commit sha>.')
param insightsImage string

@description('Origin of the static UI; the only origin CORS allows.')
param uiOrigin string = 'https://lively-river-09befa003.4.azurestaticapps.net'

@secure()
@description('Connection string for applications-api, using applications_user.')
param applicationsDbUrl string

@secure()
@description('Connection string for insights-api, using insights_user.')
param insightsDbUrl string

@secure()
@description('Shared key that applications-api sends to insights-api in X-API-Key.')
param insightsApiKey string

resource env 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: '${prefix}-env'
}

// Startup probe: 10 s delay + up to 10 checks every 20 s, about 3.5 minutes,
// enough for a paused database to resume and migrations to run.
var applicationsProbes = [
  {
    type: 'Startup'
    httpGet: { path: '/health', port: 8000 }
    initialDelaySeconds: 10
    periodSeconds: 20
    timeoutSeconds: 5
    failureThreshold: 10
  }
  {
    type: 'Liveness'
    httpGet: { path: '/health', port: 8000 }
    periodSeconds: 30
    timeoutSeconds: 5
    failureThreshold: 3
  }
]

var insightsProbes = [
  {
    type: 'Startup'
    httpGet: { path: '/health', port: 8001 }
    initialDelaySeconds: 10
    periodSeconds: 20
    timeoutSeconds: 5
    failureThreshold: 10
  }
  {
    type: 'Liveness'
    httpGet: { path: '/health', port: 8001 }
    periodSeconds: 30
    timeoutSeconds: 5
    failureThreshold: 3
  }
]

resource insights 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-insights'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8001
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        { name: 'insights-db-url', value: insightsDbUrl }
        { name: 'insights-api-key', value: insightsApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'insights-api'
          image: insightsImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'INSIGHTS_DB_URL', secretRef: 'insights-db-url' }
            { name: 'INSIGHTS_API_KEY', secretRef: 'insights-api-key' }
            { name: 'CORS_ALLOWED_ORIGIN', value: uiOrigin }
            { name: 'LOG_LEVEL', value: 'INFO' }
          ]
          probes: insightsProbes
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

resource applications 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        { name: 'applications-db-url', value: applicationsDbUrl }
        { name: 'insights-api-key', value: insightsApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'applications-api'
          image: applicationsImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'APPLICATIONS_DB_URL', secretRef: 'applications-db-url' }
            { name: 'INSIGHTS_API_KEY', secretRef: 'insights-api-key' }
            { name: 'INSIGHTS_URL', value: 'https://${insights.properties.configuration.ingress.fqdn}' }
            { name: 'CORS_ALLOWED_ORIGIN', value: uiOrigin }
            { name: 'LOG_LEVEL', value: 'INFO' }
          ]
          probes: applicationsProbes
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

output applicationsUrl string = 'https://${applications.properties.configuration.ingress.fqdn}'
output insightsUrl string = 'https://${insights.properties.configuration.ingress.fqdn}'
