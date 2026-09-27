#!/usr/bin/env bash
# Builds and starts Strapi for the Playwright suite on a throwaway Postgres
# container. Playwright's webServer runs it and sends SIGTERM when the suite
# ends. Run it by hand to poke the same stack; Ctrl-C tears everything down.
set -euo pipefail

cd "$(dirname "$0")/../.."

db_container="${E2E_DB_CONTAINER:-strapi-template-e2e-db}"
db_port="${E2E_DB_PORT:-5447}"
strapi=./node_modules/.bin/strapi
server_pid=""

stop() {
	if [ -n "$server_pid" ]; then
		kill "$server_pid" 2>/dev/null || true
		wait "$server_pid" 2>/dev/null || true
	fi
	docker rm -f "$db_container" >/dev/null 2>&1 || true
}
trap stop EXIT
trap 'exit 143' TERM INT

docker rm -f "$db_container" >/dev/null 2>&1 || true
docker run -d --rm --name "$db_container" \
	-e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi \
	-p "127.0.0.1:${db_port}:5432" postgres:18-alpine >/dev/null

until docker exec "$db_container" pg_isready -h 127.0.0.1 -U strapi -d strapi >/dev/null 2>&1; do
	sleep 0.5
done

export NODE_ENV=production
export HOST=127.0.0.1
export PORT="${E2E_PORT:-1347}"
export PUBLIC_URL="http://127.0.0.1:${PORT}"
export APP_KEYS=e2eKeyA,e2eKeyB
export API_TOKEN_SALT=e2e-api-token-salt
export ADMIN_JWT_SECRET=e2e-admin-jwt-secret
export JWT_SECRET=e2e-jwt-secret
export TRANSFER_TOKEN_SALT=e2e-transfer-token-salt
export DATABASE_CLIENT=postgres
export DATABASE_HOST=127.0.0.1
export DATABASE_PORT="$db_port"
export DATABASE_NAME=strapi
export DATABASE_USERNAME=strapi
export DATABASE_PASSWORD=strapi

"$strapi" build
"$strapi" admin:create-user --firstname E2E --lastname Admin \
	--email "${E2E_ADMIN_EMAIL:-admin@e2e.test}" --password "${E2E_ADMIN_PASSWORD:-E2eAdmin-Passw0rd}"

"$strapi" start &
server_pid=$!
wait "$server_pid"
