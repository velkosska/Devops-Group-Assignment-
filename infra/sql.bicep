// Databases for group 4 of 3B: one SQL server, one serverless database per service.
@description('Prefix for every resource name.')
param prefix string = 'sdd-3b-g4'

@description('Azure region. Defaults to the resource group region (westeurope).')
param location string = resourceGroup().location

@description('Admin login name for the SQL server.')
param sqlAdminLogin string = 'sqladmin'

@secure()
@description('Admin password for the SQL server. Passed in at deploy time, never stored in the repo.')
param sqlAdminPassword string

// One logical server holding both databases.
resource sqlServer 'Microsoft.Sql/servers@2021-11-01' = {
  name: '${prefix}-sql'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// Lets services running in Azure (our Container Apps) reach the server.
resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2021-11-01' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// One serverless database per service: 0.5 to 1 vCore, pauses after 15 idle minutes, 2 GB max.
var services = ['api', 'insights']

resource databases 'Microsoft.Sql/servers/databases@2021-11-01' = [for service in services: {
  parent: sqlServer
  name: '${prefix}-${service}-db'
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    autoPauseDelay: 15
    minCapacity: json('0.5')
    maxSizeBytes: 2147483648
    requestedBackupStorageRedundancy: 'Local'
    zoneRedundant: false
  }
}]

output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseNames array = [for (service, i) in services: databases[i].name]
