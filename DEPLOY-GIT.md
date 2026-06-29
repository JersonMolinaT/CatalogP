# Despliegue con Git — guía

A partir de ahora, publicar cambios de código es así de simple:

## Tu rutina (después de la configuración inicial)
1. **En tu PC (GitHub Desktop):** escribe un resumen del cambio abajo a la izquierda → **Commit to main** → botón **Push origin**. (Funciona en tu red, va por internet normal.)
2. **En el VPS (terminal):**
   ```
   cd /opt/perfumes && bash deploy.sh
   ```
   Eso trae los cambios, publica el sitio y reconstruye el backend. Listo.

> El contenido del día a día (productos, precios, fotos, rifas) NO usa esto: eso se hace en el panel y se guarda solo.

## Configuración inicial (una sola vez)

### En tu PC
1. Instala **GitHub Desktop** (https://desktop.github.com) e inicia sesión (crea cuenta de GitHub gratis si no tienes).
2. **File → Add local repository →** elige la carpeta `CatalogP`.
3. Te dirá que no es un repositorio → **Create a repository** → Create.
4. Arriba: **Publish repository**. Deja el nombre, marca **PÚBLICO** (no se suben contraseñas: el `.env` está excluido). Publish.

### En el VPS (terminal)
```
# instalar git
apt install -y git
# clonar tu repo (cambia USUARIO/REPO por el tuyo)
git clone https://github.com/USUARIO/REPO.git /opt/perfumes
# conservar las credenciales del backend
cp /opt/perfumes-backend/.env /opt/perfumes/backend/.env
# primer despliegue
cd /opt/perfumes && bash deploy.sh
```

## Notas
- Los **secretos** (`backend/.env`) viven SOLO en el VPS, nunca en GitHub (están en `.gitignore`).
- El repo público no expone contraseñas; solo el código del sitio.
- Si más adelante quieres despliegue 100% automático (con solo hacer Push), se puede agregar un webhook.
