#!/bin/sh
set -e

echo "🎬 Iniciando contenedor..."

# Ejecutar script de configuración inicial
# Esto creará el .env si no existe y los directorios necesarios
node setup.js

# Iniciar la aplicación
echo "🚀 Iniciando servidor..."
exec node server.js
