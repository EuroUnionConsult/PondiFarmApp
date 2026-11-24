# PondiFarm web (desktop + mobile web): builds the web version of the Expo app in
# mobile/ (the same code as the iPhone app) and serves it with nginx.
# Used by Coolify on the VPS (container port 80, mapped to 8093 on the host).
#
# Build context: the repository root (see the root .dockerignore, which sends only
# mobile/ and deploy/web/ to the builder).
#   docker build -f deploy/web/Dockerfile -t pondifarm-web .

FROM node:22-alpine AS build
WORKDIR /app/mobile
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY mobile/ ./
# The API URL is baked into the bundle at build time.
ARG EXPO_PUBLIC_API_URL=https://pondifarm-api-euc.azurewebsites.net
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN npx expo export --platform web --output-dir dist --clear \
 && ! grep -rq "localhost:8000" dist/_expo

FROM nginx:1.27-alpine
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/web/security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY --from=build /app/mobile/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
