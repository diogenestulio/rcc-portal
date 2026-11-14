# Imagem única do portal: app Next.js (standalone) + scripts empacotados (worker, migrações,
# seed de demonstração, criação de conta). Usada em homologação; produção usará a mesma imagem.
# Build:  docker build -t rcc-portal:<versao> .

FROM node:24-alpine AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
# Variáveis só para o build (validação do env.ts); os valores reais vêm do .env em execução.
RUN APP_ENV=development DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-only-build-only-build-only-0000 APP_SIGNING_KEY=build-only-build-only-build-only-0000 \
    npx next build \
 && npx esbuild scripts/worker.mts scripts/migrate.mts scripts/seed-dev.mts scripts/create-admin.mts scripts/verify-audit.mts \
      --bundle --platform=node --format=esm --target=node24 --outdir=dist-scripts --out-extension:.js=.mjs \
      --alias:@=./src --external:sharp \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=UTC
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data/media && chown app:app /data/media
COPY --from=build --chown=app:app /src/.next/standalone ./
COPY --from=build --chown=app:app /src/.next/static ./.next/static
COPY --from=build --chown=app:app /src/public ./public
COPY --from=build --chown=app:app /src/dist-scripts ./scripts
COPY --from=build --chown=app:app /src/drizzle ./drizzle
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
