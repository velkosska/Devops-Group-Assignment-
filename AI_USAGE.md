# AI Usage

One row per significant AI-assisted piece of work, including workflows, Dockerfiles and IaC.
Each member adds their own rows in the same PR as the work. Everything AI-generated is reviewed,
run and understood by the author, and approved by another team member in a pull request.

| Date | Member | Tool | What it was used for | Files | How it was verified |
| --- | --- | --- | --- | --- | --- |
| 2026-11-19 | Marija | Cursor (Claude) | Initial repo files: README stub, `.gitignore`, `.env.example` | `README.md`, `.gitignore`, `.env.example` | Read line by line; checked nothing secret is included |
| 2026-11-19 | Marija | Cursor (Claude) | CODEOWNERS and pull request template | `.github/CODEOWNERS`, `.github/pull_request_template.md` | Reviewed and approved in PR #1 |
| 2026-11-19 | Marija | Cursor (Claude) | applications-api scaffold: FastAPI `/health`, `Stage` enum, lint and test config | `applications-api/` | ruff, black, bandit, pytest locally; reviewed in PR #2 |
| 2026-11-19 | Marija | Cursor (Claude) | applications-api settings, JSON request logging and CORS restricted to the UI origin | `applications-api/app/config.py`, `logging_config.py`, `main.py`, `tests/` | ruff, black, bandit, pytest locally; CORS and logging behaviour covered by tests |
| 2026-11-19 | Alejandro | Cursor (Grok) | Domain rules for applications-api: company and role must be present and non-blank, stages must use the existing `Stage` enum, and a stage move must change to a different stage (any other stage is allowed, including backwards). Unit tests for valid and invalid cases. | `applications-api/app/domain/applications.py`, `applications-api/tests/test_application_rules.py` | From `applications-api/` with Python 3.12: `ruff check .`, `black --check .`, `bandit -r app`, `pytest` (68 passed), `coverage report --include="app/domain/*" --fail-under=70` (domain coverage 100%) |
| 2026-11-20 | Khadeja | ChatGPT | Helped implement the time-in-stage analytics calculation, write unit tests, and resolve Ruff and Black formatting issues | `insights-api/app/domain/time_in_stage.py`, `insights-api/tests/test_time_in_stage.py` | Reviewed the code; ran pytest (22 passed), Ruff (all checks passed), and Black (formatting passed) |
