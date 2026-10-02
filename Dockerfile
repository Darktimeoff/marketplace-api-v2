FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/contracts-core/package.json packages/contracts-core/
COPY packages/messaging-contracts/package.json packages/messaging-contracts/

RUN npm ci

COPY . .

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages ./packages

RUN npm ci --omit=dev

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3000}/health" || exit 1

CMD ["node", "dist/main.js"]

