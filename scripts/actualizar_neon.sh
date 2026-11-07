#!/usr/bin/env bash
# Actualiza la base de Neon que YA tiene la carga completa (cargar_neon.sh) con las migraciones nuevas
# y los datos que el ETL generó para ellas, sin volver a copiar toda la base.
#
#   1. db/migrate.sh contra Neon (aplica solo las migraciones que falten, p. ej. 0017-0018).
#   2. fn_llenar_layout_ipes() (mismo llenado que corre el ETL en local; solo llena vacíos).
#   3. Copia desde la base local las tablas que el ETL llena desde los CSV del rescate y que Neon no puede
#      calcular: alumno_baja (solo si en Neon está vacía) y carga.excluido (matrículas excluidas de la migración).
#      Nunca se copian datos de la base local encima de lo que ya cambió en Neon (cargas desde la demo).
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
psql_neon -c "BEGIN; SELECT set_config('app.usuario', 'migracion', true); SELECT fn_llenar_layout_ipes(); COMMIT;"

copiar() {   # copiar <tabla>: reemplaza la tabla de Neon con la de la base local
  { echo "BEGIN;"
    echo "SELECT set_config('app.usuario', 'migracion', true);"
    echo "DELETE FROM $1;"
    docker exec unimes-pg pg_dump -U postgres -d unimes --data-only --no-owner --no-privileges -t "$1"       | grep -v -E "^SET |^SELECT pg_catalog.set_config\('search_path'"
    echo "COMMIT;"
  } | psql_neon
}

echo "3. Tablas que solo calcula el ETL local…"
if [[ "$(psql_neon -Atc 'SELECT count(*) FROM alumno_baja')" == "0" ]]; then
  echo "   alumno_baja"; copiar public.alumno_baja
else
  echo "   alumno_baja: Neon ya tiene datos, no se toca"
fi
echo "   carga.excluido"; copiar carga.excluido

echo "Verificando…"
psql_neon -c "SELECT (SELECT string_agg(version, ', ' ORDER BY version) FROM schema_migrations WHERE version >= '0017') migraciones,
                     (SELECT count(*) FROM alumno_baja) bajas,
                     (SELECT count(entidad_residencia) FROM alumnos) con_residencia,
                     (SELECT count(*) FROM sp_layout_ipes('24-2')) layout_24_2,
                     (SELECT count(*) FROM carga.excluido) excluidos"
