# Dockerfile para Producción - Servicios Informáticos

# Etapa 1: Build
FROM node:20-alpine AS builder

# Instalar dependencias del sistema necesarias para Puppeteer y compilación
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código y limpiar basura si fuera necesario
COPY . .

# Etapa 2: Producción
FROM node:20-alpine

# Instalar Chromium y dependencias necesarias
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    sqlite

# Configurar Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar desde builder
COPY --from=builder --chown=nodejs:nodejs /app ./

# Crear directorios necesarios con permisos correctos
RUN mkdir -p backups data logs .wwebjs_auth && \
    chown -R nodejs:nodejs backups data logs .wwebjs_auth

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Dar permisos de ejecución al script de entrada
RUN chmod +x docker-entrypoint.sh

# Comando de inicio: usar el script de entrada
ENTRYPOINT ["./docker-entrypoint.sh"]
