#!/usr/bin/env bash
# Actualiza la base de Neon que YA tiene la carga completa (cargar_neon.sh) con las migraciones nuevas
# y los datos que el ETL generó para ellas, sin volver a copiar toda la base.
#
#   1. db/migrate.sh contra Neon (aplica solo las migraciones que falten, p. ej. 0017-0018).
#   2. db/etl/llenado_layout_ipes.sql (mismo llenado que corre el ETL en local; solo llena vacíos).
#   3. Copia la tabla alumno_baja desde la base local (las bajas salen de los CSV del rescate).
#
# Uso:  ./scripts/actualizar_neon.sh            (toma DATABASE_URL de .env.local)
# La URL nunca se imprime ni se escribe en disco.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="$DIR/../db"
if [[ -z "${DATABASE_URL:-}" && -f "$DIR/.env.local" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$DIR/.env.local" | head -1 | cut -d= -f2- | tr -d "'\"")"
fi
: "${DATABASE_URL:?Define DATABASE_URL con la URL del proyecto Neon}"
DIRECTA="${DATABASE_URL/-pooler./.}"

psql_neon() { MSYS_NO_PATHCONV=1 docker run --rm -i postgres:17 psql "$DIRECTA" -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "1. Migraciones…"
DATABASE_URL="$DIRECTA" bash "$DB_DIR/migrate.sh"

echo "2. Llenado del Layout IPES…"
{ echo "BEGIN;"
  echo "SELECT set_config('app.usuario', 'migracion', true);"   # la carga no va a la bitácora
  cat "$DB_DIR/etl/llenado_layout_ipes.sql"
  echo "COMMIT;"
} | psql_neon

echo "3. Bajas del programa (alumno_baja) desde la base local…"
{ echo "BEGIN;"
  echo "SELECT set_config('app.usuario', 'migracion', true);"
  echo "DELETE FROM alumno_baja;"
  docker exec unimes-pg pg_dump -U postgres -d unimes --data-only --no-owner --no-privileges -t public.alumno_baja \
    | grep -v -E "^SET |^SELECT pg_catalog.set_config\('search_path'"
  echo "COMMIT;"
} | psql_neon

echo "Verificando…"
psql_neon -c "SELECT (SELECT string_agg(version, ', ' ORDER BY version) FROM schema_migrations WHERE version >= '0017') migraciones,
                     (SELECT count(*) FROM alumno_baja) bajas,
                     (SELECT count(entidad_residencia) FROM alumnos) con_residencia,
                     (SELECT count(*) FROM sp_layout_ipes('24-2')) layout_24_2"
