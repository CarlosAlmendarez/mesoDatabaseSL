# UNIMES · Control Escolar — demo de la base de datos

Demo web de la nueva base de datos de Control Escolar del plantel San Luis Potosí: muestra lo que un
sistema completo puede hacer con los datos migrados del sistema anterior.

- **Inicio**: cifras generales, alumnos por ciclo (gráfica) y por carrera.
- **Alumnos**: búsqueda y ficha con promedios (gráfica) y kárdex.
- **Reportes**: 26 reportes por tema (procedimientos almacenados y consultas de solo lectura), cada uno con su
  explicación, filtros con menús de búsqueda y vista sugerida.
- **Consola SQL**: consultas libres en una transacción de solo lectura (una instrucción, 15 s), con ejemplos.
- **Guía**: cómo usar cada menú, agrupar, graficar y exportar, y un glosario.
- **Operaciones**: inhabilitadas por ahora (`lib/config.ts`); la demo es solo de consulta y exportación.

Todo resultado (reporte, búsqueda, kárdex o consola) se puede ver en **tabla** (ordenar, filtrar) o **gráfica**
(barras o línea, con series), **agrupar y resumir** en el servidor (conteo, suma, promedio, mínimo, máximo, distintos,
% Sí) y **exportar a Excel o CSV** (hasta 50,000 filas; el Excel trae una hoja «Información» con filtros y consulta).

Next.js 16 (App Router, Cache Components) + Tailwind 4 + Neon (`@neondatabase/serverless`). Acceso con una
contraseña única; la sesión es una cookie firmada.

## Variables de entorno

Copia `.env.example` a `.env.local` y llena:

| Variable | Qué es |
| --- | --- |
| `DATABASE_URL` | URL del proyecto Neon de UNIMES |
| `DEMO_PASSWORD` | Contraseña para entrar a la demo |
| `SESSION_SECRET` | Texto aleatorio largo para firmar la sesión |

En Vercel se definen las mismas tres en *Settings → Environment Variables*. Nunca se suben al repositorio.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Cargar la base en Neon

La base se construye en el proyecto de migración (migraciones `0001`–`0016` y ETL en Docker). Para copiarla a un
proyecto Neon vacío:

```bash
./scripts/cargar_neon.sh   # lee DATABASE_URL de .env.local
```

Se excluyen los datos de `migracion.incidencia` (la bitácora de la migración, 191 MB) para caber en el plan gratuito.
