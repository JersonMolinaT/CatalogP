// =============================================================
//  Productos — publicación al instante (sin subir archivos a mano)
//  Se monta sobre el mismo servidor Express de las rifas.
//
//  Escribe directamente en el web root del VPS:
//    - {WEB_ROOT}/js/products-data.js   -> lo que carga el sitio público
//    - {WEB_ROOT}/js/products.json      -> copia JSON (para GET /api/products)
//    - {WEB_ROOT}/assets/products/*.jpg -> fotos subidas desde el panel
//
//  Requiere WEB_ROOT en el entorno (docker-compose monta /var/www/html).
// =============================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const WEB_ROOT = process.env.WEB_ROOT || "/var/www/html";
const JS_DIR = path.join(WEB_ROOT, "js");
const IMG_DIR = path.join(WEB_ROOT, "assets", "products");
const JS_FILE = path.join(JS_DIR, "products-data.js");
const JSON_FILE = path.join(JS_DIR, "products.json");
const PREV_FILE = path.join(JS_DIR, "products-data.prev.js"); // respaldo del anterior

function ensureDirs() {
  fs.mkdirSync(JS_DIR, { recursive: true });
  fs.mkdirSync(IMG_DIR, { recursive: true });
}
// escritura atómica: escribe a .tmp y renombra (evita archivos a medias)
function writeAtomic(file, content) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

// fotos en memoria (máx 12MB por imagen); el panel comprime antes de enviar
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

module.exports = function registerProducts(app, deps) {
  const auth = deps.auth;
  ensureDirs();

  // ---- pública: catálogo actual (JSON) ----
  app.get("/api/products", (req, res) => {
    try {
      if (fs.existsSync(JSON_FILE)) {
        return res.type("application/json").send(fs.readFileSync(JSON_FILE, "utf8"));
      }
      if (fs.existsSync(JS_FILE)) {
        const js = fs.readFileSync(JS_FILE, "utf8");
        const i = js.indexOf("{"), j = js.lastIndexOf("}");
        if (i >= 0 && j > i) return res.type("application/json").send(js.slice(i, j + 1));
      }
      res.json({ products: [], currency: "COP", total_products: 0 });
    } catch (e) {
      res.status(500).json({ error: "No se pudo leer el catálogo" });
    }
  });

  // ---- admin: PUBLICAR (escribe products-data.js + products.json en vivo) ----
  app.post("/api/admin/products/publish", auth, (req, res) => {
    try {
      const cat = req.body && req.body.catalog ? req.body.catalog : req.body;
      if (!cat || !Array.isArray(cat.products)) {
        return res.status(400).json({ error: "Catálogo inválido" });
      }
      // saneo: las fotos deben ser nombres de archivo, no blobs/dataURLs
      cat.products.forEach((p) => {
        if (Array.isArray(p.photos)) {
          p.photos = p.photos.filter((f) => typeof f === "string" && !/^(blob:|data:)/.test(f));
          p.photo_count = p.photos.length;
        }
      });
      cat.generated_on = new Date().toISOString().slice(0, 10);
      cat.total_products = cat.products.length;
      if (!cat.currency) cat.currency = "COP";

      const json = JSON.stringify(cat, null, 2);
      ensureDirs();
      if (fs.existsSync(JS_FILE)) { try { fs.copyFileSync(JS_FILE, PREV_FILE); } catch (e) {} }
      writeAtomic(JSON_FILE, json);
      writeAtomic(
        JS_FILE,
        "// Publicado por el Panel Admin — " + new Date().toLocaleString("es-CO") +
          "\nwindow.CATALOG = " + json + ";\n"
      );
      res.json({ ok: true, total: cat.products.length, publishedAt: new Date().toISOString() });
    } catch (e) {
      res.status(500).json({ error: "No se pudo publicar" });
    }
  });

  // ---- admin: SUBIR FOTO (multipart, campo "photo"); devuelve el nombre final ----
  app.post("/api/admin/products/photo", auth, upload.single("photo"), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });
      const sku = ((req.body.sku || "NEW").toString().toUpperCase().replace(/[^A-Z0-9\-]/g, "")) || "NEW";
      const buf = req.file.buffer;
      const hash8 = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
      ensureDirs();
      // dedupe por contenido: si ya existe una foto con este hash, reusarla
      const existing = fs.readdirSync(IMG_DIR).find((f) => f.includes(hash8));
      if (existing) return res.json({ filename: existing, duplicated: true });
      const seq = fs.readdirSync(IMG_DIR).filter((f) => f.startsWith(sku + "-")).length + 1;
      const name = sku + "-" + String(seq).padStart(2, "0") + "-" + hash8 + ".jpg";
      writeAtomic(path.join(IMG_DIR, name), buf);
      res.json({ filename: name });
    } catch (e) {
      res.status(500).json({ error: "No se pudo guardar la imagen" });
    }
  });

  // ---- admin: eliminar una foto del servidor (limpieza opcional) ----
  app.delete("/api/admin/products/photo/:name", auth, (req, res) => {
    try {
      const name = path.basename(req.params.name || "");
      const f = path.join(IMG_DIR, name);
      if (name && fs.existsSync(f)) fs.unlinkSync(f);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "No se pudo eliminar" });
    }
  });

  console.log("Productos: rutas montadas (WEB_ROOT=" + WEB_ROOT + ")");
};
