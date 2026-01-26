# 🚀 Instalación Automática con Docker

## Instalación en UN SOLO COMANDO

```bash
curl -fsSL https://raw.githubusercontent.com/bielet20/webservices_ticket_whatsapp/main/install.sh | bash
```

O si ya tienes el repositorio clonado:

```bash
git clone https://github.com/bielet20/webservices_ticket_whatsapp.git
cd webservices_ticket_whatsapp
./install.sh
```

## ¿Qué hace el script automáticamente?

El script `install.sh` realiza TODO automáticamente:

1. ✅ Verifica que Docker esté instalado
2. ✅ Genera credenciales de admin seguras automáticamente
3. ✅ Genera secret de sesión
4. ✅ Crea el archivo `.env` con toda la configuración
5. ✅ Construye la imagen Docker
6. ✅ Inicia los contenedores
7. ✅ Te muestra las credenciales generadas
8. ✅ Te da opción de ver el QR de WhatsApp inmediatamente

**¡Todo en menos de 2 minutos!**

## Ejemplo de salida

```
================================================
  Instalación Automática - Servicios TI
  Sistema de Tickets + WhatsApp Web
================================================

✓ Docker y Docker Compose detectados

📝 Generando credenciales de seguridad...
📄 Creando archivo de configuración (.env)...
✓ Archivo .env creado

🔨 Construyendo imagen Docker...
🚀 Iniciando contenedores...
⏳ Esperando a que la aplicación esté lista...
✓ Contenedores iniciados correctamente

================================================
  ✅ INSTALACIÓN COMPLETADA
================================================

📋 Información de acceso:

  🌐 URL de la aplicación:
     http://localhost:3000

  🔐 Panel de Administración:
     URL:      http://localhost:3000/login.html
     Usuario:  admin_a1b2c3d4
     Password: AbC123XyZ789...

⚠️  GUARDA ESTAS CREDENCIALES EN UN LUGAR SEGURO

📱 WhatsApp Web:
   Para conectar WhatsApp, ejecuta:
   docker-compose logs -f

   Verás un código QR que debes escanear con WhatsApp
   desde tu teléfono (WhatsApp > Dispositivos vinculados)
```

## Después de la instalación

### 1. Acceder a la aplicación

- **Web pública**: http://localhost:3000
- **Panel admin**: http://localhost:3000/login.html

### 2. Conectar WhatsApp

```bash
# Ver logs para escanear el QR
docker-compose logs -f
```

Busca el código QR en los logs y escanéalo con:
WhatsApp en tu móvil → Menú → Dispositivos vinculados → Vincular dispositivo

### 3. Comandos útiles

#### Crear un usuario

Para crear un usuario, ejecuta el siguiente comando:

```bash
docker-compose exec app node create-user.js <username> <password> [nombre_completo] [email] [rol]
```

Ejemplo:

```bash
docker-compose exec app node create-user.js admin admin123 "Admin User" admin@example.com admin
```

```bash
# Ver estado
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f

# Detener
docker-compose stop

# Reiniciar
docker-compose restart

# Detener y eliminar
docker-compose down

# Ver solo logs de WhatsApp
docker-compose logs -f | grep -i whatsapp
```

### 4. Backup

```bash
# Backup de la base de datos
./deploy.sh backup

# O manualmente
docker cp servicios-informaticos:/app/tickets.db ./backup-$(date +%Y%m%d).db
```

## Requisitos previos

Necesitas tener instalado:

- **Docker**: https://docs.docker.com/get-docker/
- **Docker Compose**: (incluido en Docker Desktop)

### Instalación de Docker

#### En Ubuntu/Debian:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### En macOS:
```bash
# Descargar Docker Desktop desde:
# https://www.docker.com/products/docker-desktop
```

#### En Windows:
```
# Descargar Docker Desktop desde:
# https://www.docker.com/products/docker-desktop
```

## Configuración Avanzada

Si quieres personalizar algo ANTES de instalar:

```bash
# 1. Clonar repositorio
git clone https://github.com/bielet20/webservices_ticket_whatsapp.git
cd webservices_ticket_whatsapp

# 2. Editar configuración (opcional)
nano .env.production

# 3. Copiar a .env
cp .env.production .env

# 4. Iniciar manualmente
docker-compose up -d

# 5. Ver logs
docker-compose logs -f
```

## Variables de entorno disponibles

Si editas manualmente el `.env`, estas son las variables:

```bash
# Servidor
NODE_ENV=production
PORT=3000

# Seguridad
SESSION_SECRET=tu_secret_muy_largo_aqui
ADMIN_USERNAME=tu_usuario
ADMIN_PASSWORD=tu_password_seguro

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_password_app
EMAIL_FROM=tu_email@gmail.com
```

## Troubleshooting

### El contenedor no inicia

```bash
# Ver logs de error
docker-compose logs

# Reconstruir desde cero
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Puerto 3000 ya en uso

```bash
# Cambiar el puerto en docker-compose.yml
# Línea: "3000:3000" → "8080:3000"

# O detener el servicio que usa el puerto 3000
sudo lsof -i :3000
```

### WhatsApp no se conecta

```bash
# 1. Ver logs
docker-compose logs -f

# 2. Si no aparece el QR, reinicia
docker-compose restart

# 3. Si persiste, elimina la sesión y reinicia
docker-compose down
rm -rf .wwebjs_auth
docker-compose up -d
```

### Olvidé las credenciales

```bash
# Ver el archivo .env
cat .env | grep ADMIN
```

## Desinstalación

```bash
# Detener y eliminar contenedores
docker-compose down

# Eliminar también los datos
docker-compose down -v

# Eliminar imagen
docker rmi servicios-informaticos
```

## Actualización

```bash
# 1. Obtener última versión
git pull origin main

# 2. Reconstruir
docker-compose build

# 3. Reiniciar
docker-compose down
docker-compose up -d
```

## Soporte

Si encuentras problemas:

1. Revisa los logs: `docker-compose logs -f`
2. Verifica que Docker esté corriendo: `docker ps`
3. Comprueba el puerto: `netstat -an | grep 3000`
4. Revisa el archivo `.env` existe y tiene las variables correctas

## Seguridad

⚠️ **IMPORTANTE:**

1. **Cambia las credenciales** generadas automáticamente si vas a exponer la app a internet
2. **No compartas** el archivo `.env` (está en `.gitignore`)
3. **Usa HTTPS** en producción (con un reverse proxy como nginx o Caddy)
4. **Actualiza regularmente** el sistema

## 🕐 Sistema de Horas de Trabajo

El sistema ahora permite registrar y trackear las horas trabajadas en cada ticket por los técnicos.

### Características:

- ✅ Registro de horas por técnico en cada ticket
- ✅ Descripción del trabajo realizado
- ✅ Total de horas por ticket
- ✅ Desglose por técnico (cuántas horas dedicó cada uno)
- ✅ Disponible para técnicos y administradores
- ✅ Eliminación de registros (solo admins)

### Cómo usar:

1. **Abre un ticket** desde el panel de admin
2. **Busca la sección "Horas de Trabajo"**
3. **Ingresa:**
   - ID del usuario técnico
   - Nombre del técnico
   - Horas trabajadas (ej: 1, 0.5, 1.25)
   - Descripción del trabajo (opcional)
4. **Haz clic en "Registrar Horas"**
5. **Verás automáticamente:**
   - Total de horas en el ticket
   - Desglose por cada técnico
   - Historial completo con fechas

### Ejemplo:

```
Ticket #TKT-ABC-123
├─ Juan Pérez: 2h (2 registros)
├─ María García: 1.5h (1 registro)
└─ Total: 3.5h
```

## Producción

Para producción en un servidor:

1. Usa un dominio y HTTPS
2. Configura un reverse proxy (nginx/Caddy/Traefik)
3. Cambia las credenciales por defecto
4. Configura backups automáticos
5. Monitoriza los logs

Ver [DOCKER.md](DOCKER.md) y [COOLIFY.md](COOLIFY.md) para más información sobre despliegue en producción.
