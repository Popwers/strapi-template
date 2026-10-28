#!/usr/bin/env bash
# App under test for the e2e suite (`e2e.config.mts` runs it as `app.command`).
# Starts a throwaway Postgres and an S3 mock (the R2 backups bucket), builds Strapi, creates the
# admin and serves in production mode with the backup cron every 10 s. The runner stops the process
# group with SIGTERM and SIGKILLs it 10 s later, so the EXIT trap removes both containers and kills
# the server without waiting on it. Run it by hand to poke the
# same stack; Ctrl-C tears everything down.
set -euo pipefail

cd "$(dirname "$0")/../.."

db_container="${E2E_DB_CONTAINER:-strapi-template-e2e-db}"
db_port="${E2E_DB_PORT:-5447}"
s3_container="${E2E_S3_CONTAINER:-strapi-template-e2e-s3}"
s3_port="${E2E_S3_PORT:-5448}"
backup_bucket="${E2E_BACKUP_BUCKET:-e2e-backups}"
strapi=./node_modules/.bin/strapi
server_pid=""

stop() {
	if [ -n "$server_pid" ]; then
		kill -KILL "$server_pid" 2>/dev/null || true
	fi
	docker rm -fv "$db_container" "$s3_container" >/dev/null 2>&1 || true
}
trap stop EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

docker rm -fv "$db_container" "$s3_container" >/dev/null 2>&1 || true
docker run -d --rm --name "$s3_container" \
	-e COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS="$backup_bucket" \
	-p "127.0.0.1:${s3_port}:9090" adobe/s3mock:5.2.3 >/dev/null
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
export UPLOAD_LOCAL=true
# Backups: the cron fires every 10 s (six-field rule) into the mock bucket. The host may have no
# pg_dump, so only the Strapi archive is asserted; the dump step reports its own failure.
export CRON_SCHEDULE='*/10 * * * * *'
export S3_ENDPOINT="http://127.0.0.1:${s3_port}"
export S3_ACCESS_KEY_ID=e2e
export S3_SECRET_ACCESS_KEY=e2e
export S3_BUCKET="$backup_bucket"

"$strapi" build
"$strapi" admin:create-user --firstname E2E --lastname Admin \
	--email "${E2E_ADMIN_EMAIL:-admin@e2e.test}" --password "${E2E_ADMIN_PASSWORD:-E2eAdmin-Passw0rd}"

"$strapi" start &
server_pid=$!
wait "$server_pid"
