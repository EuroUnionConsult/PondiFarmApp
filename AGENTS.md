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
- Every release adds its user-facing changes to `mobile/src/lib/whatsNew.ts` (the in-app «What's new» screen), in plain English, one line per change, tagged `scan`, `herd`, `weather` or `team`. release-please does **not** do this: `npm run whatsnew:check` (in `mobile/`) fails while `APP_VERSION` has no entry. Entries for the next version can be added before the release PR; they stay hidden until `APP_VERSION` reaches them. The website reads the same file (it is built from `mobile/`). Work in progress or planned goes in `UPCOMING` in the same file (shown in the «Coming next» tab, status `in-progress` or `planned`); when it ships, remove it there and add it to `WHATS_NEW`.

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

- Language: Python 3.10+ (`azure-monitor-opentelemetry` needs 3.10 or newer; CI uses 3.11).
- Lint: `ruff check backend/` and `ruff format backend/`.
- Local run: `uvicorn main:app --reload` inside `backend/` with a virtual environment activated.
- Endpoints are versioned (`/api/v1/...`).

### Mobile (Expo / React Native)

- Stack: Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9.
- Lint: `npx expo lint` from inside `mobile/`.
- Type-check: `npx tsc --noEmit` from inside `mobile/`.
- Run: `npx expo start` from inside `mobile/`.
- **The website lives here too.** The desktop and mobile web (formerly the separate PondiFarmWeb-Desk repository) are built from the same Expo app with react-native-web, so iPhone and web always ship the same features and version (`mobile/src/lib/version.ts`).
  - Web entry: `mobile/App.web.tsx`; web-only code: `mobile/src/web/`; `mobile/public/index.html` is the page template.
  - Platform differences go in `*.web.ts(x)` files next to the native file (Metro picks them on web; `tsc` type-checks both) or in a short `Platform.OS === 'web'` branch. Never copy a shared file to change it for one platform. Current pairs: `FarmMap`, `Scan3DViewer`, `ThemeScan`, `lib/cameraPermissions` (keeps `expo-camera`, whose web QR worker loads a CDN script the CSP blocks, out of the web bundle), `lib/reloadApp` (keeps `expo-updates` out of the web bundle), `modules/lidar-scanner/index`.
  - Web session rules (sessionStorage vs «Keep me signed in», 30-min idle sign-out shared across tabs) live in `mobile/src/lib/session.ts`; the timeouts are the single constant `SESSION_TIMEOUTS` (a test build can shorten them with `EXPO_PUBLIC_IDLE_TIMEOUT_S` / `EXPO_PUBLIC_IDLE_WARNING_S`). The iPhone keeps its Keychain session and has no idle sign-out.
  - `npm run build:web` runs `scripts/preload-fonts.mjs` after the export (adds `<link rel="preload">` for the hashed Inter files); the web Dockerfile does the same.
  - Do not import native-only modules (react-native-maps, react-native-view-shot, the LiDAR module, `expo-file-system` downloads) from code that runs on web, unless a `.web` file replaces it.
  - Run the web locally: `npm run web` (dev server) or `npm run build:web` (static site in `mobile/dist/`). `EXPO_PUBLIC_API_URL` picks the backend; the backend must list the site's origin in `CORS_ORIGINS`.
  - CI (`ci-mobile.yml`, job «Web build») runs `npx expo export --platform web` on every mobile PR.
  - Deploy: `deploy/web/Dockerfile` (see [`docs/web-deploy.md`](./docs/web-deploy.md)).

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
