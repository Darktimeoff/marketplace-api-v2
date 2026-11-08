# syntax=docker/dockerfile:1

FROM node:24-trixie-slim AS deps

WORKDIR /app

COPY package*.json .npmrc ./
COPY packages/contracts-core/package.json packages/contracts-core/
COPY packages/messaging-contracts/package.json packages/messaging-contracts/

RUN --mount=type=secret,id=npm_token,env=NPM_TOKEN,required=true \
    --mount=type=cache,target=/root/.npm \
    npm ci

FROM deps AS build

COPY . .

RUN npm run build

FROM node:24-trixie-slim AS prod-deps

WORKDIR /app

COPY package*.json .npmrc ./
COPY packages/contracts-core/package.json packages/contracts-core/
COPY packages/messaging-contracts/package.json packages/messaging-contracts/

RUN --mount=type=secret,id=npm_token,env=NPM_TOKEN,required=true \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM mwader/static-ffmpeg:8.0 AS ffmpeg

FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts-core/package.json ./packages/contracts-core/
COPY --from=build /app/packages/contracts-core/dist ./packages/contracts-core/dist
COPY --from=build /app/packages/contracts-core/src ./packages/contracts-core/src
COPY --from=build /app/packages/messaging-contracts/package.json ./packages/messaging-contracts/
COPY --from=build /app/packages/messaging-contracts/dist ./packages/messaging-contracts/dist
COPY --from=build /app/packages/messaging-contracts/src ./packages/messaging-contracts/src
COPY --from=build /app/dist ./dist

USER 65532:65532

EXPOSE 3000

CMD ["dist/main.js"]
