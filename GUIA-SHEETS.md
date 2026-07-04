# 📗 Libro contable automático en Google Sheets

Tu hoja de cálculo se actualiza **sola cada hora** con todas las reservas y todos los abonos/pagos de las rifas. Sin n8n, sin instalar nada: usa Apps Script, que es gratis y corre en los servidores de Google.

---

## Paso 0 — Crear la clave (una sola vez, en el VPS)

La API expone `https://shop.crmia.cloud/api/export/ledger?key=TU_CLAVE`, protegida con una clave secreta.

1. Entra a la terminal del VPS (Hostinger → Terminal).
2. Genera una clave aleatoria y agrégala al `.env`:

```bash
cd /opt/perfumes/backend
KEY=$(openssl rand -hex 24)
echo "EXPORT_KEY=$KEY" >> .env
echo "Tu clave es: $KEY"    # cópiala, la necesitas en el paso 2
docker compose up -d --build api
```

3. Prueba en el navegador: `https://shop.crmia.cloud/api/export/ledger?key=TU_CLAVE` → debe mostrar datos JSON.

---

## Paso 1 — Crear la hoja

1. Ve a [sheets.google.com](https://sheets.google.com) → hoja en blanco.
2. Nómbrala por ejemplo **"Libro Rifas — Perfumes Originales"**.

## Paso 2 — Pegar el script

1. En la hoja: menú **Extensiones → Apps Script**.
2. Borra lo que haya y pega esto (cambia `TU_CLAVE` por la del Paso 0):

```javascript
// ====== CONFIG ======
var URL_API = "https://shop.crmia.cloud/api/export/ledger?key=TU_CLAVE";

// Trae los datos y reescribe las dos pestañas: "Pagos" y "Reservas"
function actualizarLibro() {
  var res = UrlFetchApp.fetch(URL_API, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("API respondió " + res.getResponseCode());
  var d = JSON.parse(res.getContentText());
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Pestaña PAGOS (cada abono con fecha, monto y forma) ---
  var hp = ss.getSheetByName("Pagos") || ss.insertSheet("Pagos");
  hp.clearContents();
  var headP = ["Fecha", "Rifa", "Boleta", "Comprador", "Teléfono", "Monto", "Forma", "Nota"];
  var rowsP = (d.pagos || []).map(function (p) {
    return [p.fecha, p.rifa, p.boleta, p.comprador, p.telefono, p.monto, p.forma, p.nota];
  });
  hp.getRange(1, 1, 1, headP.length).setValues([headP]).setFontWeight("bold");
  if (rowsP.length) hp.getRange(2, 1, rowsP.length, headP.length).setValues(rowsP);

  // --- Pestaña RESERVAS (estado actual de cada boleta ocupada) ---
  var hr = ss.getSheetByName("Reservas") || ss.insertSheet("Reservas");
  hr.clearContents();
  var headR = ["Fecha", "Rifa", "Boleta", "Comprador", "Teléfono", "Estado", "Pago", "Forma", "Abonado", "Falta", "Valor"];
  var rowsR = (d.reservas || []).map(function (r) {
    return [r.fecha, r.rifa, r.boleta, r.comprador, r.telefono, r.estado, r.pago, r.forma, r.abonado, r.falta, r.valor];
  });
  hr.getRange(1, 1, 1, headR.length).setValues([headR]).setFontWeight("bold");
  if (rowsR.length) hr.getRange(2, 1, rowsR.length, headR.length).setValues(rowsR);

  // marca de última actualización
  var h1 = ss.getSheetByName("Pagos");
  h1.getRange(1, headP.length + 2).setValue("Actualizado: " + new Date().toLocaleString("es-CO"));
}

// Ejecuta esto UNA VEZ para que se actualice sola cada hora
function programarActualizacion() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("actualizarLibro").timeBased().everyHours(1).create();
  actualizarLibro();
}
```

## Paso 3 — Activar

1. En Apps Script, selecciona la función **`programarActualizacion`** (menú desplegable arriba) y pulsa ▶ **Ejecutar**.
2. Google pedirá permisos la primera vez: **Revisar permisos → tu cuenta → Avanzado → Ir al proyecto → Permitir** (es tu propio script, es seguro).
3. Listo: la hoja ya tiene pestañas **Pagos** y **Reservas** y se refresca sola cada hora.

Si algún día quieres actualizar al instante: Apps Script → ejecutar `actualizarLibro`.

---

## Notas

- **Seguridad:** la clave `EXPORT_KEY` solo da acceso de *lectura* al listado. Si se filtra, genera otra (Paso 0) y cámbiala en el script.
- La pestaña **Pagos** es el libro contable real: cada fila es plata que entró (los negativos son correcciones hechas en el panel).
- Puedes agregar tus propias pestañas con tablas dinámicas o totales — el script solo toca "Pagos" y "Reservas".
