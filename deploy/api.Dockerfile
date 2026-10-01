# API image. Build context: the repository root (needs api/, shared/, db/).
#   docker build -f deploy/api.Dockerfile -t kie-api .
FROM node:24-bookworm-slim AS build
WORKDIR /src/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/ ./
COPY shared/ /src/shared/
COPY db/ /src/db/
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    MIGRATIONS_DIR=/app/dist/migrations \
    UPLOAD_DIR=/data/uploads \
    HOST=0.0.0.0 \
    PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /src/api/node_modules ./node_modules
COPY --from=build --chown=node:node /src/api/dist ./dist
COPY --from=build --chown=node:node /src/api/package.json ./package.json
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.js"]
