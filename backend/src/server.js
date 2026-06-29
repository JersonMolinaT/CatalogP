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
    const payment = req.body.payment === "paid" ? "paid" : "pending";

    if (!NUMBERS.includes(number)) return res.status(400).json({ error: "Número inválido (01–10)" });
    if (!name || onlyDigits(phone).length < 7) return res.status(400).json({ error: "Nombre y teléfono válidos son obligatorios" });

    const raffle = await prisma.raffle.findUnique({ where: { id } });
    if (!raffle || !raffle.active) return res.status(404).json({ error: "Rifa no disponible" });

    // UPDATE condicional: solo cambia si sigue 'available' -> bloqueo real
    const result = await prisma.raffleNumber.updateMany({
      where: { raffleId: id, number, status: "available" },
      data: { status: "reserved", payment, buyerName: name, buyerPhone: phone, reservedAt: new Date() },
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
    const data = {};
    if (b.status !== undefined) data.status = ["available", "reserved", "sold"].includes(b.status) ? b.status : "available";
    if (b.payment !== undefined) data.payment = ["", "paid", "pending"].includes(b.payment) ? b.payment : "";
    if (b.name !== undefined) data.buyerName = (b.name || "").toString().slice(0, 80);
    if (b.phone !== undefined) data.buyerPhone = (b.phone || "").toString().slice(0, 40);
    if (b.date !== undefined) data.reservedAt = b.date ? new Date(b.date) : null;
    if (data.status === "available" && b.status === "available") {
      // liberar: limpiar comprador si lo piden explícitamente
      if (b.clear) { data.buyerName = ""; data.buyerPhone = ""; data.payment = ""; data.reservedAt = null; }
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
        rows.push({
          rifa: r.name, premio: r.prizeName || "", numero: n.number,
          comprador: n.buyerName, telefono: n.buyerPhone,
          estado: n.status, pago: n.payment,
          fecha: n.reservedAt ? n.reservedAt.toISOString().slice(0, 10) : "",
          valor: r.price,
        });
      }
    }));
  res.json({ rows });
});

// 404 API
app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

app.listen(PORT, () => console.log(`API escuchando en puerto ${PORT}`));
