// The static UI for group 4 of 3B, hosted on Azure Static Web Apps (Free tier).
@description('Prefix for every resource name.')
param prefix string = 'sdd-3b-g4'

@description('Azure region. Defaults to the resource group region (westeurope).')
param location string = resourceGroup().location

// Empty at first: the CD pipeline uploads the UI files later with a deployment token.
resource ui 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${prefix}-ui'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

// The UI's public address, needed for CORS_ALLOWED_ORIGIN in both services.
output uiHostname string = ui.properties.defaultHostname
