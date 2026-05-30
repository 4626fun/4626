# Minimal Dockerfile for 1659 Risk Watcher
# Optimized for Railway background worker

FROM node:20.19-alpine

WORKDIR /app

# Install tsx (we use npx so we don't need global install)
RUN npm install -g tsx

# Copy only the script (it is now self-contained)
COPY 1659-risk-watcher.ts ./

ENV NODE_ENV=production

# Railway will send SIGTERM on deploys/restarts — the script now handles it
CMD ["tsx", "1659-risk-watcher.ts"]