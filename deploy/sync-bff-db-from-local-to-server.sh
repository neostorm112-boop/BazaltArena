#!/usr/bin/env bash
# Скопировать локальную БД (схема bff) на удалённый Lightsail: пользователи, passwordHash, спринты и т.д.
# Требования: локально поднят Postgres из docker-compose; SSH-ключ; на сервере ~/bazalt-arena и Docker.
#
# Использование:
#   SSH_KEY="/path/to/key.pem" REMOTE_HOST=ubuntu@13.212.81.221 ./deploy/sync-bff-db-from-local-to-server.sh
#
# Переменные:
#   REPO_ROOT      — корень репозитория (по умолчанию: два уровня вверх от этого скрипта)
#   REMOTE_HOST    — ubuntu@IP (обязательно)
#   SSH_KEY        — путь к .pem (обязательно)
#   REMOTE_DIR     — каталог приложения на сервере (по умолчанию: ~/bazalt-arena)
#   COMPOSE_LOCAL  — "docker compose" или "docker-compose" (авто: что есть)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST=ubuntu@x.x.x.x}"
SSH_KEY="${SSH_KEY:?Set SSH_KEY=/path/to/Lightsail.pem}"
if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi
chmod 400 "$SSH_KEY" 2>/dev/null || true

compose_local() {
  (cd "$REPO_ROOT" && command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && echo "docker compose") || echo "docker-compose"
}

COMPOSE_LOCAL="${COMPOSE_LOCAL:-$(compose_local)}"
SSH_BASE=(ssh -i "$SSH_KEY" -o ConnectTimeout=25 -o ServerAliveInterval=15 -o ServerAliveCountMax=20 "$REMOTE_HOST")

echo "==> Local compose: $COMPOSE_LOCAL (repo: $REPO_ROOT)"
echo "==> Stopping basalt-bff on remote (releases DB connections)..."
"${SSH_BASE[@]}" 'sudo systemctl stop basalt-bff || true'

echo "==> Streaming dump (schema bff, --clean) -> remote psql..."
(
  cd "$REPO_ROOT"
  if [[ "$COMPOSE_LOCAL" == "docker compose" ]]; then
    docker compose exec -T postgres pg_dump -U basalt -d basalt -n bff --no-owner --no-acl -c --if-exists -Fp
  else
    docker-compose exec -T postgres pg_dump -U basalt -d basalt -n bff --no-owner --no-acl -c --if-exists -Fp
  fi
) | gzip -1 | "${SSH_BASE[@]}" "cd \$HOME/bazalt-arena && if sudo docker compose version >/dev/null 2>&1; then DC='sudo docker compose'; else DC='sudo docker-compose'; fi && gunzip -c | \$DC exec -T postgres psql -U basalt -d basalt -v ON_ERROR_STOP=1"

SQL_FIX="$SCRIPT_DIR/sql/bff_normalize_user_role_enum.sql"
if [[ -f "$SQL_FIX" ]]; then
  echo "==> Normalize UserRole enum (ADMIN|USER) if dump had legacy MEMBER|MENTOR..."
  "${SSH_BASE[@]}" "cd \$HOME/bazalt-arena && if sudo docker compose version >/dev/null 2>&1; then DC='sudo docker compose'; else DC='sudo docker-compose'; fi && \$DC exec -T postgres psql -U basalt -d basalt -v ON_ERROR_STOP=1" <"$SQL_FIX"
fi

echo "==> Starting basalt-bff..."
"${SSH_BASE[@]}" 'sudo systemctl start basalt-bff'
sleep 2
"${SSH_BASE[@]}" 'curl -fsS http://127.0.0.1/api/v1/health && echo'

echo "==> Done. Log in on prod with the same emails/passwords as on your local DB."
echo "    Note: JWT from before sync are invalid if JWT secrets in server .env differ from local (they do on Lightsail)."
