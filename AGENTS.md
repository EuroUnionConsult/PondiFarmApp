# AGENTS.md — guidance for AI coding assistants

This file describes how AI coding assistants (Claude Code, Cursor, GitHub Copilot Workspace, Gemini Code Assist, and similar) should behave in this repository. Human contributors should read [`CONTRIBUTING.md`](./CONTRIBUTING.md) instead.

This is **PondiFarmApp**, a monorepo by Euro Union Consult (EUC) for livestock biometric analysis. The repository is public but source-available under the proprietary licence in [`LICENSE`](./LICENSE).

---

## 1. Always do

- Read this file and [`CONTRIBUTING.md`](./CONTRIBUTING.md) before acting.
- Make changes scoped to the task. Do not refactor unrelated code.
- Write commit messages in **English**, using [Conventional Commits](https://www.conventionalcommits.org/).
- Keep documentation in **English**. Internal team comments may be in Portuguese only when explicitly requested by a human.
- Respect the monorepo layout: backend changes go under `backend/`, mobile changes under `mobile/`, CI under `.github/`.
- For large binary assets (model weights, datasets), confirm a matching pattern exists in [`.gitattributes`](./.gitattributes) so the file is stored via Git LFS.
- Run available linters and type-checkers before declaring a task complete.

## 2. Never do

- Never commit secrets, API keys, signing material, certificates, `.env` files, or any production credentials.
- Never modify `LICENSE`, `SECURITY.md`, `CODEOWNERS`, or any file under `.github/workflows/` without explicit human approval in the prompt.
- Never push directly to `main`. Use a topic branch and open a pull request.
- Never edit `CHANGELOG.md` by hand — release-please owns it.
- Never delete a Git LFS pointer file when the asset exists. Treat LFS files like any other tracked artefact.
- Never introduce a new dependency without checking its licence and updating documentation accordingly.

## 3. Branch and commit conventions

- Topic branches: `type/short-description` (e.g. `feat/onboarding-screen`).
- Commits follow Conventional Commits. Allowed types are listed in [`CONTRIBUTING.md`](./CONTRIBUTING.md) §4.
- One logical change per commit. Avoid mixing refactors with feature work in the same commit.

## 4. Working with sub-projects

### Backend (Python / FastAPI)

- Language: Python 3.9+.
- Lint: `ruff check backend/` and `ruff format backend/`.
- Local run: `uvicorn main:app --reload` inside `backend/` with a virtual environment activated.
- Endpoints are versioned (`/api/v1/...`).

### Mobile (Expo / React Native)

- Stack: Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9.
- Lint: `npx expo lint` from inside `mobile/`.
- Type-check: `npx tsc --noEmit` from inside `mobile/`.
- Run: `npx expo start` from inside `mobile/`.

## 5. Tests

The repository does not yet have a comprehensive automated test suite. When you add or modify functionality:

- Add at least a smoke test if the area is testable.
- Document any manual test you performed in the pull request description.

## 6. Documentation expectations

- Update the relevant `README.md` (root, `backend/`, or `mobile/`) when behaviour changes.
- Update `AGENTS.md` if you discover a convention that future assistants should follow.
- Do not create new top-level documentation files (`*.md` at the repo root) without explicit instruction.

## 7. Communication style in PR descriptions

- Use plain, descriptive English.
- State the motivation (why), the change (what), and any caveat the reviewer should know.
- Link to the issue, discussion, or knowledge-base entry that motivated the change, if any.

## 8. When in doubt, ask

If a task is ambiguous, the safer behaviour is to pause and ask the human author of the prompt for clarification, rather than to guess and submit a wide-ranging change. Small, reviewable PRs are always preferred over large speculative ones.
