# Website deploy (desktop + mobile web)

The website is the web build of the Expo app in `mobile/` (react-native-web), so it always
ships the same features and the same version as the iPhone app. It replaces the separate
`PondiFarmWeb-Desk` repository, which stays untouched as a fallback until the switch below
is done and checked.

## What gets built

- `deploy/web/Dockerfile` — stage 1 runs `npm ci` and `npx expo export --platform web` in
  `mobile/`; stage 2 serves `mobile/dist` with `nginx:1.27-alpine` on port 80.
- `deploy/web/nginx.conf` + `deploy/web/security-headers.inc` — same nginx and security headers
  (CSP, HSTS, frame denial…) as the old repository.
- Build context: the **repository root**. The root `.dockerignore` sends only `mobile/` and
  `deploy/web/` to the builder (no backend, no `node_modules`).
- Build argument `EXPO_PUBLIC_API_URL` (default: the production API,
  `https://pondifarm-api-euc.azurewebsites.net`). It is baked into the bundle; the build fails
  if a `localhost:8000` URL ends up in it. If you change it, also change `connect-src` in
  `security-headers.inc`.

Local check (needs Docker):

```bash
docker build -f deploy/web/Dockerfile -t pondifarm-web .
docker run --rm -p 8093:80 pondifarm-web     # http://localhost:8093
```

## Switching Coolify to this repository

Today the Coolify app serves `https://pondifarmdesk.trazzidely.com.br` from
`EuroUnionConsult/PondiFarmWeb-Desk` (Dockerfile at the root, port mapping `8093:80`). The host
nginx (`/etc/nginx/conf.d/pondifarmdesk.conf`) proxies to `127.0.0.1:8093` and handles HTTPS;
nothing changes there.

In the Coolify app, change only the source and the Dockerfile:

| Setting | Old value | New value |
|---|---|---|
| Repository | `EuroUnionConsult/PondiFarmWeb-Desk` | `EuroUnionConsult/PondiFarmApp` |
| Branch | `main` | `main` |
| Build pack | Dockerfile | Dockerfile |
| Base directory | `/` | `/` |
| Dockerfile location | `/Dockerfile` | `/deploy/web/Dockerfile` |
| Ports exposes | `80` | `80` |
| Ports mappings | `8093:80` | `8093:80` (unchanged) |
| Build variable | `EXPO_PUBLIC_API_URL` (if set) | same value, or leave unset for production |

Then **Deploy**, and check:

1. `curl -sI https://pondifarmdesk.trazzidely.com.br | grep -i content-security-policy` (headers still there).
2. Sign in on the site; open Herd → an animal (3D model), Weather, Profile → What's new: the
   version shown must match `mobile/src/lib/version.ts`.
3. Narrow the window below the phone breakpoint: the iPhone layout opens.

**Rollback:** point the Coolify app back to `PondiFarmWeb-Desk`, `/Dockerfile`, and redeploy.

**Auto deploy:** with Auto Deploy on, every push to `main` of PondiFarmApp redeploys the site,
including backend-only pushes. If that is too often, set Coolify's watch paths to `mobile/**`
and `deploy/web/**`.

## Version and «What's new»

- Version: single source `mobile/src/lib/version.ts` (release-please). The old
  `npm run version:check` / `version:sync` of PondiFarmWeb-Desk is no longer needed: there is
  no second copy to keep in sync. Its `version-check.yml` workflow stays in the old repository
  only.
- «What's new»: `mobile/src/lib/whatsNew.ts`, checked by `npm run whatsnew:check` in `mobile/`.

## After the switch

Archive `EuroUnionConsult/PondiFarmWeb-Desk` (read-only) once the new deploy has run for a
while without problems.
