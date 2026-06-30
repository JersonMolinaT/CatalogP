// =============================================================
//  API Backend — Perfumes Originales (rifas en tiempo real)
//  Node + Express + Prisma (PostgreSQL) + JWT
// =============================================================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "cambia-este-secreto";
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors()); // mismo dominio vía nginx; abierto por simplicidad
app.use(express.json({ limit: "1mb" }));

// ---- helpers ----
const NUMBERS = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"));
const onlyDigits = (s) => (s || "").replace(/\D/g, "");

// Fuente de verdad de la coherencia pago/abono. Recibe el precio de la rifa,
// el estado de pago pedido y el monto abonado (crudo), y devuelve valores válidos:
//  - paidAmount siempre recortado a [0, price]
//  - "partial" con 0 -> "pending"; "partial" que cubre el total -> "paid"
//  - "paid" -> abonado = price (falta 0); "pending"/"" -> abonado = 0
function normalizePayment(price, payment, paidAmountRaw) {
  const p = Math.max(0, parseInt(price, 10) || 0);
  let amt = Math.max(0, Math.min(parseInt(paidAmountRaw, 10) || 0, p));
  let pay = ["paid", "pending", "partial", ""].includes(payment) ? payment : "pending";
  if (pay === "partial") {
    if (amt <= 0) { pay = "pending"; amt = 0; }
    else if (amt >= p) { pay = "paid"; amt = p; }
  } else if (pay === "paid") {
    amt = p;
  } else { // "pending" o ""
    amt = 0;
  }
  return { payment: pay, paidAmount: amt };
}

function sign(user) {
  return jwt.sign({ uid: user.id, u: user.username }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: "No autorizado" });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch (e) { return res.status(401).json({ error: "Sesión inválida" }); }
}

// vista pública de una rifa (sin datos personales de compradores)
function publicRaffle(r) {
  return {
    id: r.id, name: r.name, prizeSku: r.prizeSku, prizeName: r.prizeName,
    prizeImage: r.prizeImage, price: r.price, currency: r.currency,
    lottery: r.lottery, drawDate: r.drawDate, drawInfo: r.drawInfo, active: r.active,
    winningNumber: r.winningNumber || null, finished: !!r.finishedAt,
    numbers: r.numbers
      .slice().sort((a, b) => a.number.localeCompare(b.number))
      .map((n) => ({ number: n.number, status: n.status })),
  };
}
// vista admin (incluye comprador)
function adminRaffle(r) {
  return {
    id: r.id, name: r.name, prizeSku: r.prizeSku, prizeName: r.prizeName,
    prizeImage: r.prizeImage, price: r.price, currency: r.currency,
    lottery: r.lottery, drawDate: r.drawDate, drawInfo: r.drawInfo, active: r.active,
    winningNumber: r.winningNumber || null, drawResult: r.drawResult || null,
    finished: !!r.finishedAt,
    numbers: r.numbers.slice().sort((a, b) => a.number.localeCompare(b.number)).map((n) => ({
      number: n.number, status: n.status, payment: n.payment,
      paidAmount: n.paidAmount || 0,
      falta: Math.max(0, (r.price || 0) - (n.paidAmount || 0)),
      name: n.buyerName, phone: n.buyerPhone,
      date: n.reservedAt ? n.reservedAt.toISOString().slice(0, 10) : "",
    })),
  };
}
async function createNumbers(raffleId) {
  await prisma.raffleNumber.createMany({
    data: NUMBERS.map((number) => ({ raffleId, number })),
    skipDuplicates: true,
  });
}

// =============================================================
//  RUTAS PÚBLICAS
// =============================================================
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// listar rifas activas (para rifas.html)
app.get("/api/raffles", async (req, res) => {
  try {
    const list = await prisma.raffle.findMany({
      where: { active: true }, include: { numbers: true }, orderBy: { createdAt: "asc" },
    });
    res.json({ currency: "COP", raffles: list.map(publicRaffle) });
  } catch (e) { res.status(500).json({ error: "Error al cargar rifas" }); }
});

// RESERVAR una boleta — atómico (impide doble reserva)
const reserveLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
app.post("/api/raffles/:id/reserve", reserveLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const number = String(req.body.number || "").padStart(2, "0");
    const name = (req.body.name || "").toString().trim().slice(0, 80);
    const phone = (req.body.phone || "").toString().trim().slice(0, 40);
    const reqPayment = ["paid", "partial"].includes(req.body.payment) ? req.body.payment : "pending";

    if (!NUMBERS.includes(number)) return res.status(400).json({ error: "Número inválido (01–10)" });
    if (!name || onlyDigits(phone).length < 7) return res.status(400).json({ error: "Nombre y teléfono válidos son obligatorios" });

    const raffle = await prisma.raffle.findUnique({ where: { id } });
    if (!raffle || !raffle.active) return res.status(404).json({ error: "Rifa no disponible" });

    // normaliza/recorta el abono según el precio (evita montos > precio o negativos)
    const norm = normalizePayment(raffle.price, reqPayment, req.body.paidAmount);

    // UPDATE condicional: solo cambia si sigue 'available' -> bloqueo real
    const result = await prisma.raffleNumber.updateMany({
      where: { raffleId: id, number, status: "available" },
      data: { status: "reserved", payment: norm.payment, paidAmount: norm.paidAmount, buyerName: name, buyerPhone: phone, reservedAt: new Date() },
    });
    if (result.count === 0) {
      return res.status(409).json({ error: "Esa boleta acaba de ser apartada por otra persona. Elige otra." });
    }
    res.json({ ok: true, number, raffle: raffle.name });
  } catch (e) {
    res.status(500).json({ error: "No se pudo apartar. Intenta de nuevo." });
  }
});

// =============================================================
//  AUTENTICACIÓN
// =============================================================
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const username = (req.body.username || "").toString().trim();
    const password = (req.body.password || "").toString();
    const user = await prisma.adminUser.findUnique({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
    res.json({ token: sign(user), username: user.username });
  } catch (e) { res.status(500).json({ error: "Error al iniciar sesión" }); }
});
app.get("/api/auth/me", auth, (req, res) => res.json({ username: req.user.u }));

// =============================================================
//  RUTAS ADMIN (requieren token)
// =============================================================
app.get("/api/admin/raffles", auth, async (req, res) => {
  const list = await prisma.raffle.findMany({ include: { numbers: true }, orderBy: { createdAt: "asc" } });
  res.json({ raffles: list.map(adminRaffle) });
});

app.post("/api/admin/raffles", auth, async (req, res) => {
  try {
    const b = req.body || {};
    const r = await prisma.raffle.create({
      data: {
        name: (b.name || "Rifa").toString().slice(0, 80),
        prizeSku: b.prizeSku || null, prizeName: b.prizeName || null, prizeImage: b.prizeImage || null,
        price: parseInt(b.price, 10) || 30000, lottery: b.lottery || null,
        drawDate: b.drawDate || null, drawInfo: b.drawInfo || null,
        active: b.active !== false,
      },
    });
    await createNumbers(r.id);
    const full = await prisma.raffle.findUnique({ where: { id: r.id }, include: { numbers: true } });
    res.json(adminRaffle(full));
  } catch (e) { res.status(500).json({ error: "No se pudo crear la rifa" }); }
});

app.put("/api/admin/raffles/:id", auth, async (req, res) => {
  try {
    const b = req.body || {};
    const data = {};
    ["name", "prizeSku", "prizeName", "prizeImage", "lottery", "drawDate", "drawInfo"].forEach((k) => {
      if (b[k] !== undefined) data[k] = b[k];
    });
    if (b.price !== undefined) data.price = parseInt(b.price, 10) || 0;
    if (b.active !== undefined) data.active = !!b.active;
    await prisma.raffle.update({ where: { id: req.params.id }, data });
    const full = await prisma.raffle.findUnique({ where: { id: req.params.id }, include: { numbers: true } });
    res.json(adminRaffle(full));
  } catch (e) { res.status(500).json({ error: "No se pudo actualizar" }); }
});

app.delete("/api/admin/raffles/:id", auth, async (req, res) => {
  try { await prisma.raffle.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: "No se pudo eliminar" }); }
});

// actualizar una boleta (estado/pago/comprador) desde el admin
app.put("/api/admin/raffles/:id/numbers/:number", auth, async (req, res) => {
  try {
    const b = req.body || {};
    const raffle = await prisma.raffle.findUnique({ where: { id: req.params.id } });
    if (!raffle) return res.status(404).json({ error: "Rifa no encontrada" });
    const existing = await prisma.raffleNumber.findFirst({ where: { raffleId: req.params.id, number: req.params.number } });
    if (!existing) return res.status(404).json({ error: "Boleta no encontrada" });

    const data = {};
    if (b.status !== undefined) data.status = ["available", "reserved", "sold"].includes(b.status) ? b.status : "available";
    if (b.name !== undefined) data.buyerName = (b.name || "").toString().slice(0, 80);
    if (b.phone !== undefined) data.buyerPhone = (b.phone || "").toString().slice(0, 40);
    if (b.date !== undefined) data.reservedAt = b.date ? new Date(b.date) : null;

    // liberar: limpiar todo el comprador y el abono
    if (b.clear && (b.status === "available" || data.status === "available")) {
      data.status = "available"; data.buyerName = ""; data.buyerPhone = "";
      data.payment = ""; data.paidAmount = 0; data.reservedAt = null;
    } else if (b.payment !== undefined || b.paidAmount !== undefined) {
      // fusiona lo que llega con lo existente y normaliza (clamp + coherencia)
      const payment = b.payment !== undefined ? b.payment : existing.payment;
      const paidAmount = b.paidAmount !== undefined ? b.paidAmount : existing.paidAmount;
      const norm = normalizePayment(raffle.price, payment, paidAmount);
      data.payment = norm.payment; data.paidAmount = norm.paidAmount;
    }
    await prisma.raffleNumber.updateMany({ where: { raffleId: req.params.id, number: req.params.number }, data });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "No se pudo actualizar la boleta" }); }
});

// registrar resultado del sorteo -> calcula la boleta ganadora (último dígito)
app.post("/api/admin/raffles/:id/draw", auth, async (req, res) => {
  try {
    const result = (req.body.result || "").toString().trim();
    const digits = result.replace(/\D/g, "");
    if (!digits) return res.status(400).json({ error: "Escribe el número/resultado de la lotería" });
    const last = parseInt(digits.slice(-1), 10);
    const winning = last === 0 ? "10" : "0" + last;
    const r = await prisma.raffle.update({
      where: { id: req.params.id },
      data: { winningNumber: winning, drawResult: result, finishedAt: new Date() },
      include: { numbers: true },
    });
    res.json(adminRaffle(r));
  } catch (e) { res.status(500).json({ error: "No se pudo registrar el sorteo" }); }
});

// reabrir la rifa (borra el ganador)
app.post("/api/admin/raffles/:id/reopen", auth, async (req, res) => {
  try {
    const r = await prisma.raffle.update({
      where: { id: req.params.id },
      data: { winningNumber: null, drawResult: null, finishedAt: null },
      include: { numbers: true },
    });
    res.json(adminRaffle(r));
  } catch (e) { res.status(500).json({ error: "No se pudo reabrir" }); }
});

// listado de compradores (para exportar Excel/PDF)
app.get("/api/admin/reservations", auth, async (req, res) => {
  const list = await prisma.raffle.findMany({ include: { numbers: true }, orderBy: { createdAt: "asc" } });
  const rows = [];
  list.forEach((r) => r.numbers
    .slice().sort((a, b) => a.number.localeCompare(b.number))
    .forEach((n) => {
      if (n.status !== "available" || n.buyerName || n.buyerPhone) {
        const abonado = n.paidAmount || 0;
        rows.push({
          rifa: r.name, premio: r.prizeName || "", numero: n.number,
          comprador: n.buyerName, telefono: n.buyerPhone,
          estado: n.status, pago: n.payment,
          abonado, falta: Math.max(0, (r.price || 0) - abonado),
          fecha: n.reservedAt ? n.reservedAt.toISOString().slice(0, 10) : "",
          valor: r.price,
        });
      }
    }));
  res.json({ rows });
});

// COBRANZA — deudores con saldo pendiente (pago pendiente o abono incompleto)
// Genera un mensaje cordial listo para WhatsApp por cada comprador con saldo > 0.
app.get("/api/admin/collections", auth, async (req, res) => {
  try {
    const fmt = (v) => "$" + Number(v || 0).toLocaleString("es-CO");
    const list = await prisma.raffle.findMany({ include: { numbers: true }, orderBy: { createdAt: "asc" } });
    const rows = [];
    list.forEach((r) => r.numbers
      .slice().sort((a, b) => a.number.localeCompare(b.number))
      .forEach((n) => {
        const abonado = n.paidAmount || 0;
        const falta = Math.max(0, (r.price || 0) - abonado);
        const debe = (n.payment === "pending" || n.payment === "partial") && falta > 0 && (n.buyerName || n.buyerPhone);
        if (!debe) return;
        const nombre = (n.buyerName || "").trim();
        const saludo = nombre ? `Hola ${nombre}` : "Hola";
        const abonoTxt = abonado > 0 ? ` Hasta ahora has abonado ${fmt(abonado)} y` : "";
        const mensaje = `${saludo} 😊, ¡esperamos que estés muy bien! Te escribimos de *Perfumes Originales* con un recordatorio cordial sobre la *${r.name}*${r.prizeName ? ` (premio: ${r.prizeName})` : ""}. Tienes apartada la boleta *${n.number}*.${abonoTxt} queda un saldo pendiente de *${fmt(falta)}* para completar tu pago. Cuando puedas, nos coordinas el abono. ¡Mil gracias por participar! 🎟️✨`;
        const tel = (n.buyerPhone || "").replace(/\D/g, "");
        const wa = tel ? `https://wa.me/${tel.length === 10 ? "57" + tel : tel}?text=${encodeURIComponent(mensaje)}` : "";
        rows.push({
          rifa: r.name, numero: n.number, comprador: nombre, telefono: n.buyerPhone,
          abonado, falta, valor: r.price, pago: n.payment, mensaje, wa,
        });
      }));
    const totalFalta = rows.reduce((s, x) => s + x.falta, 0);
    res.json({ rows, totalFalta, count: rows.length });
  } catch (e) { res.status(500).json({ error: "No se pudo generar la cobranza" }); }
});

// 404 API
app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

app.listen(PORT, () => console.log(`API escuchando en puerto ${PORT}`));
