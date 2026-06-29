#!/bin/sh
# =============================================================
#  Despliegue con Git — Perfumes Originales
#  Uso en el VPS:  cd /opt/perfumes && bash deploy.sh
#  (trae los últimos cambios, publica el sitio y reconstruye el backend)
# =============================================================
set -e
REPO=/opt/perfumes
cd "$REPO"

echo "== 1/3  Trayendo últimos cambios (git pull) =="
git pull --ff-only

echo "== 2/3  Publicando el sitio =="
cp -a "$REPO"/web/. /var/www/html/
chmod -R 755 /var/www/html

echo "== 3/3  Reconstruyendo el backend =="
cd "$REPO"/backend
docker compose up -d --build

echo ""
echo "DESPLEGADO ✅  ->  https://shop.crmia.cloud"
