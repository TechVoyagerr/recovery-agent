FROM node:22-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/dev.db
RUN mkdir -p public && npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && mkdir -p /data && chown node:node /data /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/dev.db
ENV AGENT_LLM=off
ENV PORT=10000
# Prisma CLI and tsx are retained for initialization on every ephemeral boot.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/src/lib ./src/lib
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
USER node
EXPOSE 10000
CMD ["node", "scripts/boot.js"]
