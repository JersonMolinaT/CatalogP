# Guía rápida — Administrar tu tienda

**Tu sitio (público):** https://shop.crmia.cloud
**Rifas (público):** https://shop.crmia.cloud/rifas.html

## Dónde administras (paneles privados, con contraseña)

| Para qué | Dirección | Acceso |
|---|---|---|
| **Productos / precios / stock / fotos** (CMS) | https://shop.crmia.cloud/admin.html | usuario `admin` + tu contraseña |
| **Rifas** (premio, números, compradores) | https://shop.crmia.cloud/admin-rifas.html | usuario `admin` + tu contraseña |

> Al abrir cualquiera de los dos, el navegador te pide usuario y contraseña. El catálogo y las rifas públicas NO piden contraseña, solo los paneles.

## Cómo se administra (importante entender el flujo)

El sitio es **estático**, así que el panel funciona en 3 pasos:

1. **Editas** en el panel (precios, stock, agregar producto, premio de la rifa, marcar boletas vendidas, etc.). Tus cambios se guardan solos en tu navegador mientras trabajas.
2. Pulsas **“Publicar cambios”** (en productos) o **“Publicar rifas”** (en rifas). Esto **descarga un archivo** a tu computador:
   - Productos → `products-data.js`
   - Rifas → `rifa-data.js`
   - (Si agregaste fotos nuevas, también se descargan, renombradas.)
3. **Subes ese archivo al servidor** para que el cambio quede en vivo (ver abajo).

## Cómo subir el archivo al servidor (paso 3)

Como tu red bloquea el método directo, usamos el enlace temporal (igual que en el despliegue):

**A) Solo cambiaste precios / stock / rifas (un archivo .js):**
1. Sube el archivo (`products-data.js` o `rifa-data.js`) a https://litterbox.catbox.moe (72h) y copia el enlace.
2. Abre la terminal del VPS (Hostinger → botón **Terminal**, login `root`).
3. Pega el comando según el archivo:
   - Productos: `wget "PEGA_EL_ENLACE" -O /var/www/html/js/products-data.js`
   - Rifas: `wget "PEGA_EL_ENLACE" -O /var/www/html/js/rifa-data.js`
4. Recarga el sitio con `Ctrl + F5`. ¡Listo!

**B) Agregaste productos con fotos nuevas:**
1. En tu PC, abre la carpeta del proyecto y reemplaza/añade los archivos generados (el `products-data.js` en `web/js/` y las fotos en `web/assets/products/`).
2. Comprime la carpeta `web` en `web.zip`, súbela a litterbox y copia el enlace.
3. En la terminal del VPS:
   ```
   cd /tmp && wget "PEGA_EL_ENLACE" -O web.zip && unzip -o web.zip && cp -r /tmp/web/* /var/www/html/ && chmod -R 755 /var/www/html && echo "ACTUALIZADO ✅"
   ```
4. Recarga con `Ctrl + F5`.

## Reservas de rifa (cómo llegan)

Cuando un cliente aparta una boleta, te llega un **mensaje a tu WhatsApp** con su nombre, teléfono, número de boleta y forma de pago. Tú confirmas el pago y lo marcas como **Vendida/Pagado** en `admin-rifas.html`, luego publicas (paso 2 y 3).

## ¿Quieres que esto sea automático? (siguiente fase)
Hoy hay que subir el archivo a mano. Con la **fase backend** (base de datos en el VPS) el panel guardaría los cambios **al instante** desde cualquier dispositivo, sin subir archivos, y las rifas se bloquearían en tiempo real para todos. Es el siguiente paso natural cuando quieras.
