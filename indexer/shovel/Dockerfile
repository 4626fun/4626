# Tier A Shovel protocol indexer — Railway / VM worker
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates python3 procps \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/indexer/shovel

COPY indexer/shovel /app/indexer/shovel

RUN curl -fsSL -o shovel-main https://indexsupply.net/bin/main/linux/amd64/shovel \
  && chmod +x shovel-main \
  && chmod +x scripts/railway-entrypoint.sh scripts/start.sh scripts/sync-env-from-frontend.sh

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["./scripts/railway-entrypoint.sh"]
