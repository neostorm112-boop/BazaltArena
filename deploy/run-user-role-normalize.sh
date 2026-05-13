#!/usr/bin/env bash
# Привести bff."UserRole" к ADMIN|USER (идемпотентно). Нужен после дампа со старой БД или если enum разошёлся с Prisma.
# Postgres в docker compose (service postgres) должен быть Up; иначе скрипт завершается 0 (пропуск).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/deploy/sql/bff_normalize_user_role_enum.sql"
cd "$ROOT"

if [[ ! -f "$SQL" ]]; then
  echo "run-user-role-normalize: missing $SQL" >&2
  exit 1
fi

postgres_up() {
  "$@" ps postgres 2>/dev/null | grep -q "Up"
}

apply() {
  "$@" exec -T postgres psql -U basalt -d basalt -v ON_ERROR_STOP=1 <"$SQL"
}

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && postgres_up docker compose; then
  apply docker compose
  echo "run-user-role-normalize: OK (docker compose)"
  exit 0
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && postgres_up sudo docker compose; then
  apply sudo docker compose
  echo "run-user-role-normalize: OK (sudo docker compose)"
  exit 0
fi

if command -v docker-compose >/dev/null 2>&1 && postgres_up docker-compose; then
  apply docker-compose
  echo "run-user-role-normalize: OK (docker-compose)"
  exit 0
fi

if command -v docker-compose >/dev/null 2>&1 && postgres_up sudo docker-compose; then
  apply sudo docker-compose
  echo "run-user-role-normalize: OK (sudo docker-compose)"
  exit 0
fi

echo "run-user-role-normalize: skip (compose service postgres is not Up, or docker unavailable)."
exit 0
