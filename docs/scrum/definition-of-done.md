# Definition of Done

A backlog item is **done** only when all of the following are true.

## Code and review
- [ ] Merged to `main` through a pull request
- [ ] The pull request was reviewed and approved by another team member
- [ ] No direct pushes to `main`

## Quality
- [ ] CI is green: lint, format check, tests and image build all pass
- [ ] Coverage on the core logic of each service stays at or above 70%
- [ ] New logic has tests

## Delivery
- [ ] Deployed to Azure by the pipeline (no manual changes)
- [ ] `GET /health` returns 200 on the deployed services after the deploy

## Product
- [ ] All acceptance criteria of the user story are met
- [ ] Errors are shown as clear messages, never a stack trace or a hung request

## Security and docs
- [ ] No secrets in the code, config files or Git history
- [ ] README or `docs/` updated if the change affects them
- [ ] `AI_USAGE.md` updated if AI helped with a significant part
