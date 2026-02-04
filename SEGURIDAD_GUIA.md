# 🔐 Guía de Seguridad - Sistema de Gestión de Tickets

## ✅ Mejoras de Seguridad Implementadas

### 1. Configuración de Entorno
- ✅ **NODE_ENV** configurado como `production`
- ✅ **SESSION_SECRET** validado obligatorio en producción
- ✅ Cookies con flags `secure`, `httpOnly` y `sameSite: strict`

### 2. Protección contra Ataques
- ✅ **Helmet** - Headers de seguridad HTTP
- ✅ **Rate Limiting** - Protección contra fuerza bruta y DDoS
  - Login: 5 intentos cada 15 minutos
  - API general: 100 requests por minuto
  - Creación de tickets: 10 por hora
- ✅ **CSRF Protection** - Tokens en todas las operaciones de modificación
- ✅ **SQL Injection** - Consultas parametrizadas

### 3. Validación y Sanitización
- ✅ **Validación de contraseñas** - Mínimo 12 caracteres, mayúsculas, minúsculas, números y símbolos
- ✅ **Validación de emails** - Formato correcto
- ✅ **Validación de teléfonos** - Formato español
- ✅ **Sanitización de entrada** - Escape de HTML para prevenir XSS

### 4. Logging y Auditoría
- ✅ **Winston Logger** - Sistema de logging profesional
- ✅ **Logs de auditoría** - Registro de todas las acciones críticas:
  - Intentos de login (exitosos y fallidos)
  - Creación de usuarios
  - Creación de tickets
  - Errores del sistema

### 5. Gestión de Credenciales
- ✅ **Credenciales hardcodeadas eliminadas** - Ahora usan variables de entorno
- ✅ **Bcrypt** - Hash seguro de contraseñas con salt rounds = 10

---

## 📋 Requisitos de Contraseñas

Las contraseñas deben cumplir con los siguientes requisitos:

- ✅ Mínimo 12 caracteres
- ✅ Al menos una letra mayúscula (A-Z)
- ✅ Al menos una letra minúscula (a-z)
- ✅ Al menos un número (0-9)
- ✅ Al menos un carácter especial (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)

**Ejemplo de contraseña válida:** `MiPassword123!Seguro`

---

## 🚀 Instalación de Dependencias

Para instalar las nuevas dependencias de seguridad, ejecute:

```bash
npm install
```

Esto instalará:
- `express-rate-limit` - Rate limiting
- `helmet` - Security headers
- `validator` - Validación de entrada
- `winston` - Sistema de logging

---

## ⚙️ Configuración Requerida

### Variables de Entorno (.env)

Asegúrese de que su archivo `.env` contenga:

```env
# Entorno
NODE_ENV=production

# Sesión (OBLIGATORIO en producción)
SESSION_SECRET=un_secreto_muy_largo_y_aleatorio_aqui_min_32_caracteres

# Puerto
PORT=3000

# Email
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion
EMAIL_FROM=tu_email@gmail.com
EMAIL_TO=soporte@tuempresa.com

# Empresa
COMPANY_NAME=Tu Empresa
COMPANY_EMAIL=info@tuempresa.com
COMPANY_PHONE=654892803
COMPANY_PHONE_FORMATTED=+34 654 89 28 03

# Credenciales de administrador
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_contraseña_segura_aqui

# Solo para setup inicial (eliminar después)
# ADMIN_SETUP_PASSWORD=contraseña_temporal_admin
# ROOT_SETUP_PASSWORD=contraseña_temporal_root
```

### Generar SESSION_SECRET Seguro

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📁 Estructura de Logs

Los logs se guardan en el directorio `logs/`:

```
logs/
├── audit.log       # Auditoría de seguridad (logins, creación de usuarios, etc.)
├── combined.log    # Todos los logs
└── error.log       # Solo errores
```

### Rotación de Logs

Los logs se rotan automáticamente:
- Tamaño máximo: 5MB por archivo
- Archivos mantenidos: 5-10 según el tipo

---

## 🔒 Headers de Seguridad (Helmet)

Helmet configura automáticamente los siguientes headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 🛡️ Rate Limiting

### Límites Configurados

| Endpoint | Límite | Ventana | Descripción |
|----------|--------|---------|-------------|
| `/api/login` | 5 requests | 15 minutos | Previene fuerza bruta |
| `/api/*` | 100 requests | 1 minuto | Protección general API |
| `/api/tickets` (POST) | 10 requests | 1 hora | Previene spam de tickets |

### Respuesta cuando se excede el límite

```json
{
  "error": "Demasiados intentos. Intente más tarde."
}
```

---

## 📝 Logging de Auditoría

### Eventos Registrados

#### Login Exitoso
```json
{
  "level": "info",
  "message": "Login successful",
  "username": "admin",
  "userId": 1,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-02-04T08:00:00.000Z"
}
```

#### Login Fallido
```json
{
  "level": "warn",
  "message": "Login failed",
  "username": "admin",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-02-04T08:00:00.000Z"
}
```

#### Creación de Usuario
```json
{
  "level": "info",
  "message": "User created",
  "username": "nuevo_usuario",
  "rol": "tecnico",
  "createdBy": "admin",
  "ip": "192.168.1.100",
  "timestamp": "2026-02-04T08:00:00.000Z"
}
```

---

## 🔍 Monitoreo de Logs

### Ver logs en tiempo real

```bash
# Todos los logs
tail -f logs/combined.log

# Solo errores
tail -f logs/error.log

# Solo auditoría
tail -f logs/audit.log
```

### Buscar eventos específicos

```bash
# Buscar logins fallidos
grep "Login failed" logs/audit.log

# Buscar errores de hoy
grep "$(date +%Y-%m-%d)" logs/error.log
```

---

## ⚠️ Checklist de Seguridad Pre-Producción

Antes de desplegar en producción, verifique:

- [ ] `NODE_ENV=production` en `.env`
- [ ] `SESSION_SECRET` configurado (mínimo 32 caracteres)
- [ ] Contraseñas de administrador cambiadas
- [ ] HTTPS configurado (para cookies secure)
- [ ] Firewall configurado
- [ ] Backups automáticos configurados
- [ ] Logs monitoreados
- [ ] Variables de setup temporal eliminadas del `.env`

---

## 🚨 Respuesta a Incidentes

### Si detecta actividad sospechosa:

1. **Revisar logs de auditoría**
   ```bash
   tail -100 logs/audit.log
   ```

2. **Identificar IPs sospechosas**
   ```bash
   grep "Login failed" logs/audit.log | grep -o "ip.*" | sort | uniq -c
   ```

3. **Bloquear IP en firewall** (si es necesario)
   ```bash
   # Ejemplo con ufw
   sudo ufw deny from <IP_SOSPECHOSA>
   ```

4. **Cambiar credenciales comprometidas**

5. **Revisar accesos recientes**
   ```bash
   grep "Login successful" logs/audit.log | tail -20
   ```

---

## 📞 Soporte

Para consultas de seguridad:
- Revisar logs en `logs/`
- Consultar documentación en `SEGURIDAD.md`
- Revisar análisis de seguridad en `brain/analisis_seguridad.md`

---

## 🔄 Actualizaciones de Seguridad

### Mantener dependencias actualizadas

```bash
# Verificar vulnerabilidades
npm audit

# Actualizar dependencias
npm update

# Actualizar dependencias con vulnerabilidades
npm audit fix
```

---

*Última actualización: 4 de febrero de 2026*  
*Versión: 2.0.0 (Seguridad Mejorada)*
