FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PRAETOR_HTTP_HOST=0.0.0.0 \
    PRAETOR_HTTP_PORT=3000 \
    PRAETOR_HTTP_WRITES=false

WORKDIR /app
RUN addgroup -S praetor && adduser -S -G praetor praetor \
    && mkdir -p /app/data \
    && chown -R praetor:praetor /app

COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=praetor:praetor /app/dist ./dist

USER praetor
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

ENTRYPOINT ["node", "dist/http-index.js"]
