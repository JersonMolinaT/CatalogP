# 🚀 Publicar productos EN VIVO (nuevo sistema)

A partir de ahora el **Panel Admin** de productos publica **al instante**, igual que las
rifas: editas, pulsas **Publicar cambios** y el sitio se actualiza solo. **Ya no hay que
descargar archivos ni subirlos a mano.** Las fotos también se suben directo desde el panel.

Para activarlo hay que **desplegar una vez** el código nuevo (backend + web). Después,
administrar es solo abrir el panel y publicar.

---

## Qué cambió (resumen técnico)

- **backend/** — se añadió el módulo `src/products.js` con 3 rutas nuevas:
  - `POST /api/admin/products/publish` → escribe `products-data.js` en el servidor (en vivo).
  - `POST /api/admin/products/photo` → sube una foto (código único + anti-duplicados).
  - `GET /api/products` → catálogo actual en JSON.
  - `docker-compose.yml` ahora **monta el web root** (`/var/www/html`) para poder publicar ahí.
- **web/admin.html** — el botón *Publicar cambios* ahora publica en vivo (con login).
  Si no hay servidor, cae automáticamente al modo anterior (descarga). Verás un indicador
  arriba: **● Publicación en vivo** o **Modo local (descarga)**.
- **web/js/products-data.js** — ya incluye los **4 perfumes nuevos** (Asad, Amber Rouge,
  Amber Oud Gold Edition, Swiss Army Classic) con ficha completa; solo les faltan las fotos,
  que agregarás desde el panel tras desplegar.

---

## Despliegue (una sola vez) — ~10 minutos

> Necesitas: la carpeta del proyecto en tu PC (ya sincronizada) y la **terminal del VPS**
> (Hostinger → botón **Terminal**, login `root`). Igual que despliegues anteriores usamos
> litterbox para pasar los archivos.

### Paso 1 — Backend (activa la publicación en vivo)

1. En tu PC, **comprime la carpeta `backend`** en `backend.zip`.
2. Súbela a https://litterbox.catbox.moe (72h) y copia el enlace.
3. En la terminal del VPS (ajusta la ruta si tu backend está en otra carpeta —
   normalmente `/opt/perfumes/backend`):

   ```bash
   cd /tmp && wget "PEGA_EL_ENLACE" -O backend.zip && unzip -o backend.zip
   cp -r /tmp/backend/* /opt/perfumes/backend/
   cd /opt/perfumes/backend
   docker compose up -d --build api
   ```

4. Verifica que quedó bien:

   ```bash
   docker compose logs --tail=15 api      # debe decir: "Productos: rutas montadas (WEB_ROOT=/var/www/html)"
   curl -s http://127.0.0.1:3001/api/products | head -c 120   # debe responder JSON
   ```

### Paso 2 — Web (panel nuevo + los 4 perfumes)

1. En tu PC, **comprime la carpeta `web`** en `web.zip`.
2. Súbela a litterbox y copia el enlace.
3. En la terminal del VPS:

   ```bash
   cd /tmp && wget "PEGA_EL_ENLACE" -O web.zip && unzip -o web.zip \
     && cp -r /tmp/web/* /var/www/html/ && chmod -R 755 /var/www/html && echo "WEB OK ✅"
   ```

4. Abre el sitio y recarga con **Ctrl + F5**.

---

## Cómo administrar de ahora en adelante (el flujo que querías)

1. Abre **https://shop.crmia.cloud/admin.html**.
2. Arriba debe decir **● Publicación en vivo**. La primera vez te pedirá **usuario y
   contraseña** (los mismos del panel de rifas); quedan guardados.
3. Edita precios, stock, fichas o **agrega fotos** (botón **+** en la ficha del producto).
4. Pulsa **Publicar cambios** → *"Publicado en vivo"*. El catálogo público se actualiza solo.
   **Sin descargar nada, sin terminal, desde cualquier dispositivo.**

### Para terminar los 4 perfumes nuevos
Tras el despliegue, entra al panel, abre cada uno (Asad, Amber Rouge, Amber Oud Gold Edition,
Swiss Army Classic), agrega sus fotos con **+** y pulsa **Publicar cambios**. Listo.

---

## Notas

- **Respaldo automático:** al publicar, el `products-data.js` anterior queda guardado como
  `products-data.prev.js` por si quieres volver atrás.
- **Anti-duplicados:** si subes dos veces la misma foto, el sistema la reconoce y no la repite.
- **Si el servidor estuviera caído**, el panel te avisa y puedes usar el modo local (descarga)
  como antes; nada se pierde.
- **Ruta del web root:** el sistema asume `/var/www/html`. Si tu sitio vive en otra carpeta,
  ponla en el `.env` del backend como `WEB_ROOT=/ruta/de/tu/web` y en el volumen del
  `docker-compose.yml`.
