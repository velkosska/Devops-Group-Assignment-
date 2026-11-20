// Foundation for group 4 of 3B: logs and the Container Apps environment.
@description('Prefix for every resource name.')
param prefix string = 'sdd-3b-g4'

@description('Azure region. Defaults to the resource group region (westeurope).')
param location string = resourceGroup().location

// Where the request logs of both services go (used for monitoring and the SLO).
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// The shared space both Container Apps will run in, sending logs to the workspace.
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

output environmentName string = env.name
output logAnalyticsWorkspaceName string = logs.name
