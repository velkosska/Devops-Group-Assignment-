# Monitoring and Reliability Decision

## Context
The application uses two backend services: applications-api and insights-api. Both need consistent request logging so the team can monitor reliability in Azure.

## Decision
Both services will log HTTP requests as structured JSON to stdout.

Each request log will include:
- HTTP method
- Request path
- Response status code
- Request duration in milliseconds

Azure Log Analytics will be used to query these logs and monitor:
- Request count
- Error rate
- Response time

The team will create a monitoring dashboard and define an SLO measuring the percentage of successful requests completed within a chosen response-time threshold.

## Alternatives Considered
- Plain-text logs: rejected because they are harder to query consistently.
- Separate logging formats for each service: rejected because they complicate dashboards and SLO calculations.

## Consequences
- Both services can use consistent monitoring queries.
- Production errors and slow requests are easier to identify.
- Monitoring depends on successful log ingestion into Azure Log Analytics.
- The dashboard and SLO must be verified after deployment.
