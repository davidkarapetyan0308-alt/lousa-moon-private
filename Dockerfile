FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY apps/api ./apps/api
COPY packages ./packages
COPY src ./src
COPY tsconfig.json ./tsconfig.json
COPY scripts/start-production-api.sh ./scripts/start-production-api.sh
COPY scripts/ensure-auth-db-schema.js ./scripts/ensure-auth-db-schema.js

RUN npm run prisma:generate \
  && chmod +x ./scripts/start-production-api.sh \
  && chown -R node:node /app

ENV NODE_ENV=production \
    APP_ENV=production \
    API_HOST=0.0.0.0 \
    PORT=8080

EXPOSE 8080
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["./scripts/start-production-api.sh"]
