# Contributing to PondiFarmApp

Thank you for your interest in PondiFarmApp. This document describes how internal contributors and authorised collaborators work in this repository.

> **External contributors:** open a Discussion or contact `projects@eurounionconsult.com` before opening a pull request. Contributions are accepted only under the terms of [`LICENSE`](./LICENSE).

---

## 1. Workflow at a glance

1. Create a topic branch from `main`.
2. Make focused, scoped commits with Conventional Commit messages (see §4).
3. Open a pull request against `main`. CI must be green; at least one approving review is required.
4. After merge, **release-please** opens (or updates) a release pull request that maintains the `CHANGELOG.md` and version bump.
5. Merging the release pull request triggers tag creation. Deployment is manual at this stage.

---

## 2. Repository layout

```
PondiFarmApp/
├── backend/        FastAPI service
├── mobile/         Expo / React Native app
└── .github/        CI, templates, code-owners
```

Each sub-project carries its own README with setup instructions.

---

## 3. Branch strategy

- `main` is protected: no direct pushes, one approving review required, all required CI checks must pass.
- Topic branches follow the form `type/short-description`, e.g. `feat/onboarding-screen`, `fix/permissions-android`, `docs/contributing-guide`.
- Long-lived branches are discouraged. Keep work scoped and merge early.
- Force-pushes to `main` and to any release branch are forbidden.

---

## 4. Commit messages — Conventional Commits

Every commit message MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) format. This is enforced by `commitlint` at commit time and is the input that drives `release-please`.

```
<type>(<optional scope>): <imperative description>

[optional body]

[optional footer(s)]
```

### Allowed types

| Type        | When to use                                            | Triggers version bump |
|-------------|--------------------------------------------------------|------------------------|
| `feat`      | A new user-visible feature                             | minor                  |
| `fix`       | A bug fix                                              | patch                  |
| `perf`      | A performance improvement                              | patch                  |
| `refactor`  | A code change that neither fixes a bug nor adds a feat | none                   |
| `docs`      | Documentation only                                      | none                   |
| `test`      | Adding or correcting tests                              | none                   |
| `build`     | Build system or external dependencies                   | none                   |
| `ci`        | Changes to CI configuration                             | none                   |
| `chore`     | Other changes that do not modify src or test            | none                   |
| `security`  | A security-related change                               | patch                  |
| `revert`    | Reverts a previous commit                               | matches reverted       |

### Breaking changes

Append `!` after the type or scope, **and** add a `BREAKING CHANGE:` footer.

```
feat(api)!: rename /scan endpoint to /v1/scan

BREAKING CHANGE: the previous /scan endpoint has been removed.
Clients must call /v1/scan.
```

This triggers a major version bump.

### Scopes

Common scopes: `mobile`, `backend`, `models`, `ci`, `release`, `deps`. Use the most specific scope that still makes sense.

### Examples

```
feat(mobile): add onboarding carousel
fix(backend): handle missing breed parameter gracefully
docs: clarify capture protocol in README
chore(deps): bump expo to 54.0.34
ci: enable CodeQL for Python
security(backend): tighten CORS allowlist in production profile
```

---

## 5. Pull requests

- Open the PR against `main`. Fill the PR template.
- Link any related issue or discussion.
- Keep PRs focused. A reviewer should be able to read the diff in under fifteen minutes.
- All status checks must be green before merge.
- At least one approving review from a code owner (see [`.github/CODEOWNERS`](./.github/CODEOWNERS)) is required.

### Review etiquette

We use [Conventional Comments](https://conventionalcomments.org/) in code review: prefix each comment with `praise:`, `nitpick:`, `suggestion:`, `issue:`, `todo:`, or `question:` to communicate intent clearly.

---

## 6. Code style

### Mobile (TypeScript / React Native)

- TypeScript `strict` mode.
- Prefer functional components and hooks.
- File names: `PascalCase.tsx` for components, `camelCase.ts` for everything else.
- Lint: Expo defaults via `expo lint`.

### Backend (Python / FastAPI)

- Python 3.9+.
- Lint and format: `ruff` (config in `backend/ruff.toml`).
- Type hints encouraged in new code. Strict typing is a longer-term goal.
- Endpoints are versioned: `/api/v1/...`.

---

## 7. Working with large files (Git LFS)

Model weights and other large binary artefacts (`.pt`, `.pkl`, `.onnx`, `.mlpackage`, `.bin`) are stored via [Git LFS](https://git-lfs.com/).

Before cloning or working with the repo:

```bash
brew install git-lfs    # macOS — or your platform equivalent
git lfs install
git lfs pull
```

When adding a new binary asset, ensure it matches a pattern in [`.gitattributes`](./.gitattributes) — otherwise the file will be committed as a regular blob and bloat the repository.

---

## 8. Releases

Releases are managed automatically by [release-please](https://github.com/googleapis/release-please).

- Every push to `main` is parsed for Conventional Commits.
- release-please opens or updates a `chore(main): release X.Y.Z` PR with the proposed version bump and the generated `CHANGELOG.md` entries.
- Merging that PR creates the GitHub Release and the version tag.

Do **not** edit `CHANGELOG.md` by hand. If a release entry is wrong, fix it through a follow-up commit on `main` and let release-please regenerate.

---

## 9. Security

Never commit secrets, API keys, certificates, signing material, or production environment files. The repository is public.

If you discover a security issue, follow [`SECURITY.md`](./SECURITY.md) and do not open a public issue.

---

## 10. Governance

This repository is owned by Euro Union Consult, Lda. Code ownership for review purposes is defined in [`.github/CODEOWNERS`](./.github/CODEOWNERS). Strategic decisions are made by the project coordinator at EUC.

For all other questions, contact `projects@eurounionconsult.com`.
