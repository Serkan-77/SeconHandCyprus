# Web (Next.js) image. Build context: the repository root.
#   docker build -f deploy/web.Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://www.kibrisikincielcim.com -t kie-web .
# NEXT_PUBLIC_* values are compiled into the client bundle, so they are build
# arguments. Secrets are never build arguments; they come at run time.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CONTACT_EMAIL=""
ARG NEXT_PUBLIC_ADSENSE_CLIENT=""
ARG NEXT_PUBLIC_ADSENSE_SLOT_HOME=""
ARG NEXT_PUBLIC_ADSENSE_SLOT_RESULTS=""
ARG NEXT_PUBLIC_ADSENSE_SLOT_LISTING=""
ARG NEXT_PUBLIC_ADSENSE_CMP_READY="0"
ARG NEXT_PUBLIC_AUTH_GOOGLE="0"
ENV NEXT_TELEMETRY_DISABLED=1 \
    API_INTERNAL_URL=http://api:4000
RUN test -n "$NEXT_PUBLIC_SITE_URL" && npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
