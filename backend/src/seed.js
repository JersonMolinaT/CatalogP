// Inicialización de datos: crea el usuario admin y una rifa de ejemplo si no existen.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const NUMBERS = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"));

async function main() {
  const username = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD || "perfumes123";

  // Crear/actualizar admin
  const passwordHash = bcrypt.hashSync(password, 10);
  await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
  console.log(`Admin listo: usuario "${username}"`);

  // Crear una rifa de ejemplo solo si no hay ninguna
  const count = await prisma.raffle.count();
  if (count === 0) {
    const r = await prisma.raffle.create({
      data: {
        name: "Rifa 1",
        prizeSku: "LAT-OFG",
        prizeName: "Lattafa Bade'e Al Oud - Oud For Glory",
        prizeImage: "LAT-OFG-01-f6bf8822.jpg",
        price: 30000,
        currency: "COP",
        lottery: "Lotería de Boyacá",
        drawDate: "",
        drawInfo: "Gana la boleta cuyo número coincida con el ÚLTIMO DÍGITO del premio mayor. Si termina en 0, gana la boleta 10.",
        active: true,
      },
    });
    await prisma.raffleNumber.createMany({
      data: NUMBERS.map((number) => ({ raffleId: r.id, number })),
      skipDuplicates: true,
    });
    console.log("Rifa de ejemplo creada (Rifa 1).");
  } else {
    console.log(`Ya existen ${count} rifa(s); no se crea ejemplo.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
