# Repository Guidelines

## Project Structure & Module Organization
`src/backend/InvenTree/` contains the Django application, REST API, templates, plugins, and app-specific modules such as `part/`, `stock/`, and `order/`. `src/frontend/` contains the React/Vite UI library and app code, with browser tests under `src/frontend/tests/` and Playwright setup in `src/frontend/playwright/`. Project automation lives in the root `tasks.py`, documentation in `docs/`, deployment helpers in `contrib/`, and shared images/assets in `assets/`.

## Build, Test, and Development Commands
Use `invoke` from the repository root for backend and integrated workflows:

- `invoke install`: install Python dependencies and plugins.
- `invoke update`: refresh the local environment after dependency or schema changes.
- `invoke dev.setup-dev --tests`: install dev tools, pre-commit hooks, and test data helpers.
- `invoke dev.server`: start the Django development server on `0.0.0.0:8000`.
- `invoke dev.frontend-server`: compile translations and start the Vite dev server.
- `invoke dev.test --runtest order`: run backend tests for a focused module.
- `cd src/frontend && yarn build`: build the frontend bundle.
- `cd src/frontend && npx playwright test --ui`: run frontend end-to-end tests locally.

## Coding Style & Naming Conventions
Backend Python follows PEP 8, Google-style docstrings, and Ruff formatting rules from `pyproject.toml`. Frontend TypeScript/JavaScript is formatted by Biome (`biome.json`) using spaces, single quotes, and no trailing commas. Keep module names lowercase, React components in PascalCase, and write user-facing strings in English so they can flow through the translation pipeline.

## Testing Guidelines
New behavior should ship with tests; CI tracks overall coverage and public docs state the project targets coverage above 90%. Use `invoke dev.test --check --coverage` for backend coverage, and Playwright for UI flows. If you change database models, run `invoke migrate` and commit the generated migration files or CI will reject the PR.

## Commit & Pull Request Guidelines
Branch from `master`; do not push directly to `master`. Recent history shows short, imperative subjects, sometimes with Conventional Commit scopes, for example `feat(frontend): ...`, `chore(deps): ...`, or `Fix ... (#123)`. Keep one feature or fix per branch, describe behavioral impact in the PR, link the related issue when applicable, and include screenshots or test evidence for UI changes. Run pre-commit before opening the PR.

## Security & Configuration Tips
Do not commit secrets; gitleaks runs in pre-commit and CI. Base local configuration on `src/backend/InvenTree/config_template.yaml`, and keep environment-specific overrides out of version control.
