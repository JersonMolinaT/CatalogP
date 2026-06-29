# Backend — Perfumes Originales (rifas en tiempo real)

API en Node + Express + Prisma + PostgreSQL, en Docker. Sirve `/api/...` detrás de NGINX
en el mismo dominio (`https://shop.crmia.cloud/api/...`).

## Qué hace
- Guarda rifas y boletas en PostgreSQL (datos centrales, no se pierden).
- **Reserva atómica**: dos personas no pueden tomar la misma boleta (bloqueo real compartido).
- Login del panel con usuario/contraseña (JWT).
- El panel de rifas guarda **al instante**; las reservas de clientes aparecen solas.

## Despliegue en el VPS (resumen — la guía paso a paso la da el asistente)

1. **Subir** la carpeta `backend/` al servidor (zip → litterbox → wget → unzip), por ejemplo a `/opt/perfumes-backend`.
2. **Crear `.env`** en esa carpeta (copiar de `.env.example`) con contraseñas reales:
   - `DB_PASSWORD`, `JWT_SECRET` (texto largo aleatorio), `ADMIN_USER`, `ADMIN_PASSWORD`.
3. **Levantar** con Docker:
   ```
   cd /opt/perfumes-backend
   docker compose up -d --build
   ```
   La primera vez construye la imagen, crea la base de datos, aplica el esquema y siembra
   el admin + una rifa de ejemplo.
4. **Verificar**: `curl http://127.0.0.1:3001/api/health` → debe responder `{"ok":true,...}`.
5. **NGINX**: agregar el proxy de `/api` (ver bloque abajo) y recargar.
6. **Frontend**: subir el `web/` actualizado (rifas.html y admin-rifas.html ya llaman al API).

## Bloque NGINX (proxy /api → contenedor)
Dentro del `server { ... }` de `/etc/nginx/sites-available/default`:
```
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
> Nota: `admin-rifas.html` ahora tiene su propio login (no necesita la contraseña de NGINX);
> se quita su `auth_basic`. `admin.html` (productos) sigue con contraseña de NGINX por ahora.

## Operación
- Ver logs: `docker compose logs -f api`
- Reiniciar: `docker compose restart api`
- Apagar: `docker compose down` (los datos persisten en el volumen `pgdata`)
- Respaldo de la base de datos:
  `docker compose exec db pg_dump -U perfumes perfumes > backup_$(date +%F).sql`
