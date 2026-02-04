# 🚀 Guía de Instalación y Prueba - Mejoras de Seguridad

## ⚠️ Problema Detectado: Permisos de NPM

Se ha detectado un problema de permisos en el directorio de caché de npm que impide la instalación automática de dependencias.

---

## 🔧 Solución: Instalar Dependencias

### Opción 1: Corregir Permisos (Recomendado)

```bash
# Corregir permisos del directorio npm
sudo chown -R $(whoami) ~/.npm

# Instalar dependencias
cd "/Users/bielrivero/APP FONT Y PLA ZERO"
npm install
```

### Opción 2: Instalar sin Caché

```bash
cd "/Users/bielrivero/APP FONT Y PLA ZERO"
npm install --cache /tmp/npm-cache
```

### Opción 3: Usar pnpm (Alternativa)

```bash
# Instalar pnpm si no está instalado
npm install -g pnpm

# Instalar dependencias con pnpm
cd "/Users/bielrivero/APP FONT Y PLA ZERO"
pnpm install
```

---

## 📦 Dependencias a Instalar

Las siguientes dependencias de seguridad se agregarán:

```json
{
  "express-rate-limit": "^7.1.5",  // Rate limiting
  "helmet": "^7.1.0",               // Security headers
  "validator": "^13.11.0",          // Validación de entrada
  "winston": "^3.11.0"              // Sistema de logging
}
```

---

## ✅ Verificar Instalación

Después de instalar las dependencias, ejecute:

```bash
npm run verify-security
```

**Salida esperada:**
```
🔐 Verificación de Seguridad del Sistema
════════════════════════════════════════
✅ NODE_ENV configurado como production
✅ SESSION_SECRET configurado
✅ logger.js existe
✅ security-utils.js existe
✅ express-rate-limit instalado
✅ helmet instalado
✅ validator instalado
✅ winston instalado
════════════════════════════════════════
✅ ¡Configuración de seguridad correcta!
```

---

## 🧪 Probar la Aplicación

### 1. Iniciar el Servidor

```bash
npm start
```

**Salida esperada:**
```
🔐 Iniciando configuración de seguridad...
✓ Contraseña del admin ya está hasheada
🌐 Servidor escuchando en http://localhost:3000
📧 Sistema de email configurado
✅ Base de datos inicializada
```

### 2. Verificar Headers de Seguridad

Abrir otra terminal y ejecutar:

```bash
curl -I http://localhost:3000
```

**Debe mostrar headers de seguridad:**
```
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'...
Referrer-Policy: strict-origin-when-cross-origin
```

### 3. Probar Rate Limiting

```bash
# Intentar 6 logins en rápida sucesión (debe bloquear el 6to)
for i in {1..6}; do
  echo "Intento $i:"
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' \
    -w "\nStatus: %{http_code}\n\n"
  sleep 1
done
```

**Resultado esperado:**
- Intentos 1-5: Status 401 (credenciales incorrectas)
- Intento 6: Status 429 (demasiados intentos)

### 4. Verificar Logging

```bash
# Ver logs en tiempo real
tail -f logs/combined.log
```

**Debe mostrar:**
```json
{
  "level": "warn",
  "message": "Login failed",
  "username": "test",
  "ip": "::1",
  "timestamp": "2026-02-04T08:30:00.000Z"
}
```

### 5. Probar Validación de Contraseñas

Abrir el navegador en `http://localhost:3000/admin` y:

1. Iniciar sesión con las credenciales de producción
2. Ir a "Usuarios"
3. Intentar crear un usuario con contraseña débil: `test123`

**Resultado esperado:**
```
Error: La contraseña no cumple con los requisitos de seguridad
- La contraseña debe tener al menos 12 caracteres
- Debe contener al menos una letra mayúscula
- Debe contener al menos un carácter especial
```

4. Crear usuario con contraseña fuerte: `TestUser123!Secure`

**Resultado esperado:**
```
✓ Usuario creado exitosamente
```

---

## 🔍 Checklist de Pruebas

### Seguridad Básica
- [ ] Servidor inicia sin errores
- [ ] Headers de seguridad presentes (Helmet)
- [ ] Rate limiting funciona en login
- [ ] Logs se crean en `logs/`

### Validación
- [ ] Contraseñas débiles son rechazadas
- [ ] Emails inválidos son rechazados
- [ ] Teléfonos inválidos son rechazados
- [ ] Entrada HTML es sanitizada

### Logging
- [ ] Login exitoso se registra
- [ ] Login fallido se registra
- [ ] Creación de usuario se registra
- [ ] Creación de ticket se registra

### Rate Limiting
- [ ] Login bloqueado después de 5 intentos
- [ ] API bloqueada después de 100 requests/min
- [ ] Tickets bloqueados después de 10/hora

---

## 📊 Pruebas Automatizadas

### Script de Prueba Completo

```bash
#!/bin/bash

echo "🧪 Ejecutando pruebas de seguridad..."
echo ""

# 1. Verificar que el servidor esté corriendo
echo "1. Verificando servidor..."
curl -s http://localhost:3000 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Servidor respondiendo"
else
    echo "❌ Servidor no responde"
    exit 1
fi

# 2. Verificar headers de seguridad
echo ""
echo "2. Verificando headers de seguridad..."
HEADERS=$(curl -sI http://localhost:3000)

if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    echo "✅ X-Content-Type-Options presente"
else
    echo "❌ X-Content-Type-Options faltante"
fi

if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo "✅ X-Frame-Options presente"
else
    echo "❌ X-Frame-Options faltante"
fi

# 3. Verificar rate limiting
echo ""
echo "3. Verificando rate limiting..."
for i in {1..6}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST http://localhost:3000/api/login \
        -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}')
    
    if [ $i -eq 6 ] && [ $STATUS -eq 429 ]; then
        echo "✅ Rate limiting funciona (bloqueó intento 6)"
        break
    fi
done

# 4. Verificar logs
echo ""
echo "4. Verificando logs..."
if [ -d "logs" ]; then
    echo "✅ Directorio logs/ existe"
    if [ -f "logs/combined.log" ]; then
        echo "✅ combined.log existe"
    fi
    if [ -f "logs/audit.log" ]; then
        echo "✅ audit.log existe"
    fi
else
    echo "⚠️  Directorio logs/ no existe (se creará al iniciar)"
fi

echo ""
echo "✅ Pruebas completadas"
```

Guardar como `test-security.sh` y ejecutar:

```bash
chmod +x test-security.sh
./test-security.sh
```

---

## 🐛 Solución de Problemas

### Error: "Cannot find module 'helmet'"

**Causa:** Dependencias no instaladas  
**Solución:** Ejecutar `npm install` después de corregir permisos

### Error: "EPERM: operation not permitted"

**Causa:** Permisos de npm incorrectos  
**Solución:** `sudo chown -R $(whoami) ~/.npm`

### Error: "SESSION_SECRET is not set"

**Causa:** Archivo .env no se está leyendo  
**Solución:** Verificar que `.env` existe y tiene permisos de lectura

### Logs no se crean

**Causa:** Directorio logs/ no tiene permisos  
**Solución:** `mkdir -p logs && chmod 755 logs`

---

## 📝 Notas Importantes

1. **Permisos de npm**: El error de permisos es común en macOS. La solución recomendada es corregir los permisos del directorio `~/.npm`.

2. **Dependencias opcionales**: Aunque las dependencias de seguridad son importantes, el servidor puede iniciar sin ellas (con funcionalidad reducida). Sin embargo, **NO se recomienda para producción**.

3. **Logs**: Los logs se crean automáticamente al iniciar el servidor. No es necesario crear el directorio manualmente.

4. **HTTPS**: Para que las cookies `secure` funcionen correctamente, necesitas configurar HTTPS en producción.

---

## ✅ Siguiente Paso

Una vez instaladas las dependencias, ejecutar:

```bash
# 1. Verificar seguridad
npm run verify-security

# 2. Iniciar servidor
npm start

# 3. Abrir navegador
open http://localhost:3000
```

---

*Guía creada: 4 de febrero de 2026*
