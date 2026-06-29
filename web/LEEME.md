# Perfumes Originales — Sitio web (catálogo Premium)

Sitio estático, rápido y elegante. Funciona **sin servidor**: ábrelo con doble clic.

## Ver el sitio
Abre `web/index.html` en tu navegador (Chrome/Edge/Safari). Verás el catálogo con tus fotos, filtros, buscador, favoritos y botones de WhatsApp.

## Qué incluye
- Home con hero, categorías y marcas
- Catálogo con filtros (marca, género, familia, colección), orden y buscador con autocompletado
- Ficha de producto (galería con zoom, notas olfativas, descripción, botones WhatsApp Comprar/Cotizar, favoritos, compartir)
- Favoritos guardados en el navegador, modo claro/oscuro, 100% responsive, PWA-ready
- WhatsApp con mensaje automático: nombre, presentación, precio y código (SKU)

## Administrar el catálogo (Panel Admin) — recomendado
Abre **`web/admin.html`** en el navegador. Sin servidor ni código, puedes:
- Editar **precios, precio anterior (ofertas) y stock** en una tabla (cambios al instante).
- **Mostrar/ocultar** referencias y ver alertas de stock bajo/agotado.
- Editar la **ficha completa** (marca, nombre, género, familia, notas, descripción, etiquetas).
- **Agregar o duplicar** referencias nuevas.
- **Agregar fotos**: se renombran con código único y se descargan para que las muevas a `web/assets/products/`.
- Ver totales: referencias, unidades y **valor del inventario**.

Para publicar: pulsa **“Publicar cambios”** → se descarga `products-data.js`. Reemplaza con él el de `web/js/`. (Tus ediciones quedan guardadas en el navegador hasta que publiques.)

## Rifas (multi-rifa)
Página **`web/rifas.html`** (enlazada en el menú). Soporta **varias rifas a la vez** (Rifa 1, Rifa 2, Rifa 3…): si hay más de una activa, el cliente las cambia con un selector arriba. Mecánica de cada una: 10 boletas (01–10), $30.000 c/u; cada boleta representa su serie (01 → 01,11,21,…,91). Gana la boleta cuyo número coincide con el **último dígito** del resultado de la lotería (si termina en 0, gana la 10). El cliente elige número (al azar o manual), ingresa **nombre + teléfono** y **forma de pago** (Pago inmediato / Pendiente), el número se **bloquea** y la reserva llega a tu WhatsApp.

Gestiónalas en **`web/admin-rifas.html`** (botón “🎟️ Rifas” dentro del panel):
- **Varias rifas**: crear, duplicar, eliminar y cambiar entre ellas con pestañas.
- Por rifa: **premio** (referencia), nombre, valor, lotería, fecha, estado (activa/oculta).
- Por boleta: estado (Disponible/Apartada/Vendida), **pago** (Pagado/Pendiente), comprador, teléfono y fecha. Ves recaudado y pendiente.
- **Exportar compradores**: botón **Excel (CSV)** y **PDF** con todas las rifas — rifa, premio, número, comprador, teléfono, estado, pago y fecha.
- “Publicar rifas” descarga `rifa-data.js` → reemplázalo en `web/js/`.

> Nota: el bloqueo es inmediato en el dispositivo del cliente; el bloqueo **compartido entre todos** en tiempo real (y guardado central para no perder datos) llega con la base de datos del VPS. Mientras tanto, tu “base de datos” es el `rifa-data.js` publicado + las exportaciones de respaldo; las reservas te llegan por WhatsApp y las confirmas en el panel.

## Editar textos del sitio
`web/js/config.js` → número de WhatsApp, frase del hero, barra superior, moneda, etc.

## Cargar precios
Edita el diccionario `COMMERCIAL` en `scripts/build_catalog.py` (precio, precio anterior para ofertas, stock) y vuelve a ejecutar:
```
python3 scripts/build_catalog.py
```
Esto regenera `web/js/products-data.js`. Sin precio, el producto muestra “Consultar precio”.

## Agregar productos / fotos (flujo diario)
1. Sube las fotos a la carpeta `Perfumes`.
2. Si es una referencia nueva: añádela en `PRODUCTS` y mapea sus archivos en `PHOTO_TO_SKU` dentro de `scripts/build_catalog.py`.
3. Ejecuta `python3 scripts/build_catalog.py`. Las fotos repetidas se omiten por hash; se copian las nuevas a `web/assets/products/`.

## Desplegar en tu VPS (resumen)
1. Sube la carpeta `web/` al servidor (ej. `/var/www/perfumes`).
2. NGINX sirviendo esa carpeta como root:
```
server {
  listen 80;
  server_name TU_DOMINIO;
  root /var/www/perfumes;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  gzip on; gzip_types text/css application/javascript image/svg+xml;
}
```
3. SSL gratis con Certbot: `sudo certbot --nginx -d TU_DOMINIO`.

> Esta es la versión 1 (estática). La arquitectura escala a Next.js + API + panel admin cuando quieras dar el siguiente paso.
