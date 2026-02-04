#!/bin/bash

echo "🔧 Instalando dependencias de seguridad..."
echo ""

# Intentar instalar con diferentes métodos
echo "Método 1: npm install --no-save (sin modificar package-lock.json)"
npm install --no-save express-rate-limit helmet validator winston 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Dependencias instaladas exitosamente"
    exit 0
fi

echo ""
echo "Método 2: npm install --legacy-peer-deps"
npm install --legacy-peer-deps express-rate-limit helmet validator winston 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Dependencias instaladas exitosamente"
    exit 0
fi

echo ""
echo "⚠️  No se pudieron instalar las dependencias automáticamente"
echo ""
echo "Por favor, ejecute manualmente:"
echo "  sudo chown -R \$(whoami) ~/.npm"
echo "  npm install"
echo ""
exit 1
