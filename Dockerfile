FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NODE_ENV=production
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && groupmod -n killbyte node && usermod -l killbyte -d /app node
COPY --from=builder --chown=killbyte:killbyte /app/package.json ./package.json
COPY --from=builder --chown=killbyte:killbyte /app/node_modules ./node_modules
COPY --from=builder --chown=killbyte:killbyte /app/.next ./.next
COPY --from=builder --chown=killbyte:killbyte /app/public ./public
COPY --from=builder --chown=killbyte:killbyte /app/prisma ./prisma
COPY --from=builder --chown=killbyte:killbyte /app/server.mjs ./server.mjs
COPY --from=builder --chown=killbyte:killbyte /app/worker.mjs ./worker.mjs
USER killbyte
EXPOSE 3000
CMD ["node", "server.mjs"]
