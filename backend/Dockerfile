FROM node:20-slim

WORKDIR /app

# Prisma necesita openssl
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Dependencias (cacheable)
COPY package.json ./
RUN npm install --omit=dev && npm install prisma@5.22.0

# Código
COPY prisma ./prisma
COPY src ./src

# Generar cliente Prisma
RUN npx prisma generate

EXPOSE 3000

# Al arrancar: sincroniza esquema, siembra datos y levanta la API.
CMD sh -c "npx prisma db push --skip-generate && node src/seed.js && node src/server.js"
