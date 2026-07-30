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
# El catálogo (productos y fotos) se gestiona desde el panel admin y se guarda
# EN VIVO en el servidor. Lo preservamos para que un despliegue de código NUNCA
# lo pise con una versión vieja del repo (esto ya causó pérdidas antes).
cp -a /var/www/html/js/products-data.js /tmp/_po_pd.js   2>/dev/null || true
cp -a /var/www/html/js/products.json    /tmp/_po_pj.json 2>/dev/null || true
cp -a "$REPO"/web/. /var/www/html/
# Restaurar el catálogo publicado desde el panel (no el del repo)
[ -f /tmp/_po_pd.js ]   && cp -a /tmp/_po_pd.js   /var/www/html/js/products-data.js || true
[ -f /tmp/_po_pj.json ] && cp -a /tmp/_po_pj.json /var/www/html/js/products.json    || true
rm -f /tmp/_po_pd.js /tmp/_po_pj.json
chmod -R 755 /var/www/html

echo "== 3/3  Reconstruyendo el backend =="
cd "$REPO"/backend
docker compose up -d --build

echo ""
echo "DESPLEGADO ✅  ->  https://shop.crmia.cloud"
