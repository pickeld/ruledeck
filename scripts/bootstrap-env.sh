#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo ".env already exists"
  exit 0
fi
PASS="$(openssl rand -hex 16)"
SECRET="$(openssl rand -hex 32)"
MANAGER="$(openssl rand -base64 12 | tr -d '/+=' )"
DEVELOPER="$(openssl rand -base64 12 | tr -d '/+=' )"
cat > .env <<EOF
DATABASE_URL=postgresql://ruledeck:${PASS}@postgres:5432/ruledeck
POSTGRES_USER=ruledeck
POSTGRES_PASSWORD=${PASS}
POSTGRES_DB=ruledeck
SESSION_SECRET=${SECRET}
SEED_MANAGER_PASSWORD=${MANAGER}
SEED_DEVELOPER_PASSWORD=${DEVELOPER}
OUTPUT_ROOT=/output
RULEDECK_HTTPS=false
APP_PUBLIC_URL=http://127.0.0.1:3000
EOF
cat > .local-credentials <<EOF
RuleDeck local logins (gitignored)
Manager:  manager@ruledeck.local / ${MANAGER}
Developer: dev@ruledeck.local / ${DEVELOPER}
UI: http://127.0.0.1:3000
EOF
echo "Wrote .env and .local-credentials"
