#!/bin/bash

echo "🧪 Pruebas de Seguridad - Sistema de Gestión de Tickets"
echo "════════════════════════════════════════════════════════"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# Función para verificar
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $2"
        ((FAILED++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠️${NC}  $1"
    ((WARNINGS++))
}

# 1. Verificar que el servidor esté corriendo
echo "1️⃣  Verificando servidor..."
curl -s http://localhost:3000 > /dev/null 2>&1
check $? "Servidor respondiendo en puerto 3000"
echo ""

# 2. Verificar headers de seguridad
echo "2️⃣  Verificando headers de seguridad (Helmet)..."
HEADERS=$(curl -sI http://localhost:3000 2>/dev/null)

echo "$HEADERS" | grep -q "X-Content-Type-Options"
check $? "X-Content-Type-Options: nosniff"

echo "$HEADERS" | grep -q "X-Frame-Options"
check $? "X-Frame-Options presente"

echo "$HEADERS" | grep -q "Strict-Transport-Security"
if [ $? -eq 0 ]; then
    check 0 "Strict-Transport-Security (HSTS)"
else
    warn "HSTS no presente (normal en HTTP, requerido en HTTPS)"
fi

echo "$HEADERS" | grep -q "Content-Security-Policy"
check $? "Content-Security-Policy configurado"

echo ""

# 3. Verificar rate limiting en login
echo "3️⃣  Verificando rate limiting (login)..."
echo "   Enviando 6 intentos de login..."

RATE_LIMITED=false
for i in {1..6}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST http://localhost:3000/api/login \
        -H "Content-Type: application/json" \
        -d '{"username":"test_rate_limit","password":"test"}' 2>/dev/null)
    
    if [ "$STATUS" = "429" ]; then
        RATE_LIMITED=true
        break
    fi
    sleep 0.5
done

if [ "$RATE_LIMITED" = true ]; then
    check 0 "Rate limiting bloqueó después de 5 intentos"
else
    check 1 "Rate limiting NO funcionó (esperaba 429)"
fi

echo ""

# 4. Verificar estructura de logs
echo "4️⃣  Verificando sistema de logging..."

if [ -d "logs" ]; then
    check 0 "Directorio logs/ existe"
    
    if [ -f "logs/combined.log" ]; then
        check 0 "combined.log creado"
    else
        warn "combined.log no existe (se creará al iniciar)"
    fi
    
    if [ -f "logs/audit.log" ]; then
        check 0 "audit.log creado"
        
        # Verificar que hay logs de los intentos de login
        if grep -q "Login failed" logs/audit.log 2>/dev/null; then
            check 0 "Logs de auditoría funcionando (Login failed registrado)"
        else
            warn "No se encontraron logs de 'Login failed'"
        fi
    else
        warn "audit.log no existe (se creará al iniciar)"
    fi
    
    if [ -f "logs/error.log" ]; then
        check 0 "error.log creado"
    else
        warn "error.log no existe (se creará si hay errores)"
    fi
else
    warn "Directorio logs/ no existe (se creará automáticamente)"
fi

echo ""

# 5. Verificar archivos de seguridad
echo "5️⃣  Verificando archivos de seguridad..."

[ -f "logger.js" ]
check $? "logger.js existe"

[ -f "security-utils.js" ]
check $? "security-utils.js existe"

[ -f "verify-security.js" ]
check $? "verify-security.js existe"

echo ""

# 6. Verificar dependencias
echo "6️⃣  Verificando dependencias de seguridad..."

node -e "require('helmet')" 2>/dev/null
check $? "helmet instalado"

node -e "require('express-rate-limit')" 2>/dev/null
check $? "express-rate-limit instalado"

node -e "require('winston')" 2>/dev/null
check $? "winston instalado"

node -e "require('validator')" 2>/dev/null
check $? "validator instalado"

echo ""

# 7. Verificar configuración
echo "7️⃣  Verificando configuración (.env)..."

if [ -f ".env" ]; then
    check 0 "Archivo .env existe"
    
    # Verificar NODE_ENV (sin mostrar el valor)
    if grep -q "NODE_ENV=production" .env 2>/dev/null; then
        check 0 "NODE_ENV=production configurado"
    else
        check 1 "NODE_ENV NO está en production"
    fi
    
    # Verificar SESSION_SECRET existe (sin mostrar el valor)
    if grep -q "SESSION_SECRET=" .env 2>/dev/null; then
        check 0 "SESSION_SECRET configurado"
    else
        check 1 "SESSION_SECRET NO configurado"
    fi
else
    check 1 "Archivo .env NO existe"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "📊 Resumen de Pruebas"
echo "════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ Pasadas:${NC} $PASSED"
if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Advertencias:${NC} $WARNINGS"
fi
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Fallidas:${NC} $FAILED"
fi
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ¡Todas las pruebas pasaron!${NC}"
    echo "   El sistema está correctamente configurado."
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Pruebas pasadas con advertencias${NC}"
    echo "   Revise las advertencias antes de producción."
    exit 0
else
    echo -e "${RED}❌ Algunas pruebas fallaron${NC}"
    echo "   Corrija los errores antes de continuar."
    exit 1
fi
