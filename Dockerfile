# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS production

ENV NODE_ENV=production
ENV PORT=3002

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist

USER app

EXPOSE 3002

CMD ["node", "build/server/index.js"]
