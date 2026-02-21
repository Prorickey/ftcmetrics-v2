FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun install
RUN cd packages/db && bunx prisma generate

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api ./packages/api
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.base.json ./
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
RUN mkdir -p packages/api/uploads && chown appuser:nodejs packages/api/uploads
EXPOSE 3001
ENV PORT=3001
USER appuser
CMD ["bun", "run", "packages/api/src/index.ts"]
