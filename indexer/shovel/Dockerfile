# Tier A Shovel protocol indexer — Railway / VM worker
# Builder must use this Dockerfile (see railway.shovel.toml), not frontend/Dockerfile.agent.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates python3 procps postgresql-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/indexer/shovel

COPY indexer/shovel /app/indexer/shovel

RUN curl -fsSL -o shovel-main https://indexsupply.net/bin/main/linux/amd64/shovel \
  && chmod +x shovel-main \
  && chmod +x scripts/railway-entrypoint.sh scripts/start.sh scripts/sync-env-from-frontend.sh \
    scripts/apply-protocol-index-rls.sh scripts/health-server.mjs scripts/smoke-index-decode.mjs

ENV PORT=8080
ENV NODE_ENV=production
# /ready lag threshold (continuous monitoring). Railway /health is process-only.
ENV SHOVEL_HEALTH_MAX_LAG_BLOCKS=256
# Grace before /ready treats missing tips / lag as hard failures.
ENV SHOVEL_HEALTH_WARMUP_MS=180000
# Emit [shovel-status] lag lines to Railway logs for continuous observability.
ENV SHOVEL_STATUS_LOG_MS=60000

EXPOSE 8080

CMD ["./scripts/railway-entrypoint.sh"]
