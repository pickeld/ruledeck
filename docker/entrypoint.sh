#!/bin/sh
set -eu
if [ "$(id -u)" = "0" ]; then
  mkdir -p /output
  chown -R node:node /output
  exec runuser -u node -- "$0" "$@"
fi
npx prisma db push
npx tsx prisma/seed.ts
exec npx next start --hostname 0.0.0.0 --port 3000
