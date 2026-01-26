#!/bin/bash

# Script de instalación automática con Docker
# Sistema de Tickets con WhatsApp Web

set -e

echo "================================================"
echo "  Instalación Automática - Servicios TI"
echo "  Sistema de Tickets + WhatsApp Web"
echo "================================================"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para generar contraseñas seguras
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Función para generar secrets
generate_secret() {
    openssl rand -hex 32
}

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker no está instalado${NC}"
    echo "Por favor instala Docker primero: https://docs.docker.com/get-docker/"
    exit 1
fi

# Verificar si Docker Compose está instalado
DC_CMD=""
if command -v docker-compose &> /dev/null; then
    DC_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DC_CMD="docker compose"
else
    echo -e "${RED}❌ Error: Docker Compose no está instalado${NC}"
    echo "Por favor instala Docker Compose primero"
    exit 1
fi

echo -e "${BLUE}✓ Docker y Docker Compose detectados (Usando: $DC_CMD)${NC}"
echo ""

# Generar credenciales automáticamente
echo -e "${YELLOW}📝 Generando credenciales de seguridad...${NC}"
ADMIN_USER="admin_$(openssl rand -hex 4)"
ADMIN_PASS=$(generate_password)
SESSION_SECRET=$(generate_secret)

# Solicitar email (opcional)
echo ""
echo -e "${BLUE}Configuración de Email (opcional - puedes dejarlo en blanco):${NC}"
read -p "Email de empresa (opcional): " EMAIL_USER
read -p "Contraseña de email (opcional): " EMAIL_PASS

if [ -z "$EMAIL_USER" ]; then
    EMAIL_USER="info@myiatech.xyz"
    EMAIL_PASS=""
fi

# Crear archivo .env
echo ""
echo -e "${YELLOW}📄 Creando archivo de configuración (.env)...${NC}"

cat > .env << EOF
# Configuración generada automáticamente
# Fecha: $(date)

# Servidor
NODE_ENV=production
PORT=3000

# Seguridad
SESSION_SECRET=${SESSION_SECRET}

# Credenciales de Admin (GUÁRDALAS EN LUGAR SEGURO)
ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${EMAIL_USER}
EMAIL_PASS=${EMAIL_PASS}
EMAIL_FROM=${EMAIL_USER}
EOF

echo -e "${GREEN}✓ Archivo .env creado${NC}"

# Detener contenedores existentes si los hay
echo ""
echo -e "${YELLOW}🛑 Deteniendo contenedores existentes (si los hay)...${NC}"
$DC_CMD down 2>/dev/null || true

# Construir imagen
echo ""
echo -e "${YELLOW}🔨 Construyendo imagen Docker...${NC}"
$DC_CMD build --no-cache

# Iniciar contenedores
echo ""
echo -e "${YELLOW}🚀 Iniciando contenedores...${NC}"
$DC_CMD up -d

# Esperar a que la aplicación esté lista
echo ""
echo -e "${YELLOW}⏳ Esperando a que la aplicación esté lista...${NC}"
sleep 10

# Verificar que el contenedor está corriendo
if $DC_CMD ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Contenedores iniciados correctamente${NC}"
else
    echo -e "${RED}❌ Error al iniciar contenedores${NC}"
    echo "Revisa los logs con: $DC_CMD logs"
    exit 1
fi

# Mostrar información importante
echo ""
echo "================================================"
echo -e "${GREEN}  ✅ INSTALACIÓN COMPLETADA${NC}"
echo "================================================"
echo ""
echo -e "${BLUE}📋 Información de acceso:${NC}"
echo ""
echo -e "  🌐 URL de la aplicación:"
echo -e "     ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  🔐 Panel de Administración:"
echo -e "     URL:      ${GREEN}http://localhost:3000/login.html${NC}"
echo -e "     Usuario:  ${YELLOW}${ADMIN_USER}${NC}"
echo -e "     Password: ${YELLOW}${ADMIN_PASS}${NC}"
echo ""
echo -e "${RED}⚠️  GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO${NC}"
echo ""
echo -e "${BLUE}📱 WhatsApp Web:${NC}"
echo -e "   Para conectar WhatsApp, ejecuta:"
echo -e "   ${GREEN}$DC_CMD logs -f${NC}"
echo ""
echo -e "   Verás un código QR que debes escanear con WhatsApp"
echo -e "   desde tu teléfono (WhatsApp > Dispositivos vinculados)"
echo ""
echo -e "${BLUE}📊 Comandos útiles:${NC}"
echo -e "   Ver logs:         ${GREEN}$DC_CMD logs -f${NC}"
echo -e "   Detener:          ${GREEN}$DC_CMD stop${NC}"
echo -e "   Reiniciar:        ${GREEN}$DC_CMD restart${NC}"
echo -e "   Ver estado:       ${GREEN}$DC_CMD ps${NC}"
echo -e "   Ejecutar script:  ${GREEN}./deploy.sh [comando]${NC}"
echo ""
echo "================================================"
echo ""

# Preguntar si quiere ver los logs ahora
echo -e "${YELLOW}¿Deseas ver los logs ahora para escanear el QR de WhatsApp? (s/n)${NC}"
read -p "> " -n 1 -r
echo
if [[ $REPLY =~ ^[SsYy]$ ]]; then
    echo ""
    echo -e "${BLUE}Mostrando logs... (Presiona Ctrl+C para salir)${NC}"
    echo ""
    sleep 2
    $DC_CMD logs -f
fi
