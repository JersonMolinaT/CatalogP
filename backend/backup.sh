#!/bin/sh
# Respaldo automático de la base de datos (rifas/compradores).
# Se programa con cron para correr a diario. Guarda en /opt/backups y
# conserva solo los últimos 14 archivos.
set -e
cd /opt/perfumes-backend
mkdir -p /opt/backups
FILE="/opt/backups/perfumes_$(date +%F_%H%M).sql"
docker compose exec -T db pg_dump -U perfumes perfumes > "$FILE"
gzip -f "$FILE"
# conservar solo los últimos 14 respaldos
ls -1t /opt/backups/*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "Respaldo creado: ${FILE}.gz"
