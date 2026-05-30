# Minimal Dockerfile for 1659 Risk Watcher
# Optimized for Railway background worker

FROM node:20.19-alpine

WORKDIR /app

RUN npm install -g tsx

COPY 1659-risk-watcher.ts ./

ENV NODE_ENV=production
# Railway sets PORT automatically. The script will start a healthcheck server on it.
EXPOSE 8080

# The script handles SIGTERM gracefully for clean Railway deploys
CMD ["tsx", "1659-risk-watcher.ts"]