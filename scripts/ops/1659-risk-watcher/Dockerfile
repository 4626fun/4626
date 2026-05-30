# Minimal Dockerfile for 1659 Risk Watcher (standalone)
# Designed for Railway / long-running process

FROM node:20.19-alpine

WORKDIR /app

# Install tsx globally for running TS directly
RUN npm install -g tsx

# Copy the watcher script (self-contained after recent refactors)
COPY scripts/ops/1659-risk-watcher.ts ./1659-risk-watcher.ts

# Optional: copy a .env.example if you want
# COPY scripts/ops/1659-risk-watcher/.env.example .env.example

# The script loads .env from multiple locations automatically
ENV NODE_ENV=production

# Run the watcher continuously
CMD ["tsx", "1659-risk-watcher.ts"]