#!/usr/bin/env bash
# Copia la base local de UNIMES (contenedor Docker unimes-pg, migraciones 0001-0016 + ETL)
# a un proyecto Neon VACÍO. Excluye los datos de migracion.incidencia (191 MB; la tabla se crea vacía)
# para caber en el plan gratuito.
#
# Uso:  DATABASE_URL='postgresql://…' ./scripts/cargar_neon.sh
#       (o define DATABASE_URL en .env.local). La URL nunca se escribe en disco ni en el repositorio.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${DATABASE_URL:-}" && -f "$DIR/.env.local" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$DIR/.env.local" | head -1 | cut -d= -f2- | tr -d "'\"")"
fi
: "${DATABASE_URL:?Define DATABASE_URL con la URL del proyecto Neon}"

# pg_restore necesita la conexión directa, no la del pooler.
DIRECTA="${DATABASE_URL/-pooler./.}"

psql_neon() { MSYS_NO_PATHCONV=1 docker run --rm -i postgres:17 psql "$DIRECTA" -X -v ON_ERROR_STOP=1 "$@"; }

tablas="$(psql_neon -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")"
if [[ "$tablas" != "0" ]]; then
  echo "La base de destino ya tiene $tablas tablas: este script solo carga en una base vacía." >&2
  exit 1
fi

echo "Respaldando la base local (sin datos de migracion.incidencia)…"
docker exec unimes-pg pg_dump -U postgres -d unimes -Fc --no-owner --no-privileges \
  --exclude-table-data=migracion.incidencia > "$DIR/.unimes.dump"
ls -lh "$DIR/.unimes.dump" | awk '{print "  tamaño del respaldo:", $5}'

echo "Restaurando en Neon…"
MSYS_NO_PATHCONV=1 docker run --rm -i postgres:17 \
  pg_restore --no-owner --no-privileges --exit-on-error -d "$DIRECTA" < "$DIR/.unimes.dump"
rm -f "$DIR/.unimes.dump"

echo "Verificando…"
psql_neon -c "SELECT (SELECT count(*) FROM alumnos) alumnos, (SELECT count(*) FROM inscripcion_materia) inscripciones,
                     (SELECT count(*) FROM intento_calificacion) calificaciones,
                     (SELECT count(*) FROM schema_migrations) migraciones,
                     pg_size_pretty(pg_database_size(current_database())) tamano"
