FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY cli ./cli
COPY docker ./docker
COPY next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ./
COPY public ./public

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build@127.0.0.1:5432/build

RUN npx prisma generate && npm run build \
  && mkdir -p /output \
  && chown -R node:node /app /output

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
