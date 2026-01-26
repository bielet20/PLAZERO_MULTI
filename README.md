# Sistema de Gestión de Servicios Informáticos

Sistema profesional de gestión de tickets para servicios informáticos con integración completa de WhatsApp Web.

## 🚀 Características

- **Página web profesional** con diseño responsive
- **Sistema de tickets** completo con base de datos SQLite
- **WhatsApp Web embebido** - Chat integrado en el panel de administración
- **Panel de administración** con autenticación segura
- **Notificaciones automáticas** por email
- **Plantillas de mensajes** WhatsApp para técnicos
- **Historial de contactos** y conversaciones
- **8 servicios disponibles** incluyendo desarrollo web y apps

## 📱 WhatsApp Integrado

### Funcionalidades WhatsApp:
- ✅ WhatsApp Web embebido en panel admin
- ✅ Ver y gestionar todos tus chats
- ✅ Enviar/recibir mensajes desde la web
- ✅ Plantillas predefinidas para técnicos
- ✅ Historial de conversaciones
- ✅ Botón flotante en web pública
- ✅ Enlace directo en emails

**Teléfono de la Empresa:** 624 620 893

## 📋 Servicios Ofrecidos

1. Reparación de Equipos
2. Montaje de Redes
3. Soporte de Impresoras
4. Seguridad Informática
5. Detección de Errores
6. Soporte Técnico General
7. **Programación de Aplicaciones Personalizadas** ⭐
8. **Desarrollo de Entornos Web** ⭐

## 🐳 Despliegue

### ⚡ Instalación Automática (MÁS FÁCIL)

**Instala TODO con un solo comando:**

```bash
./install.sh
```

El script hace TODO automáticamente:
- ✅ Genera credenciales seguras
- ✅ Crea configuración
- ✅ Construye e inicia Docker
- ✅ Te muestra las credenciales de acceso

📖 **Guía completa:** Ver [INSTALACION_AUTOMATICA.md](INSTALACION_AUTOMATICA.md)

### Opción 1: Coolify (Producción en Servidor)

Despliega fácilmente en tu servidor con Coolify:

```bash
# 1. Conecta tu repo GitHub en Coolify
# 2. Selecciona Dockerfile.coolify
# 3. Configura variables de entorno
# 4. ¡Despliega!
```

📖 **Guía completa Coolify:** Ver [COOLIFY.md](COOLIFY.md)

### Opción 2: Docker Compose Manual (Local/VPS)

```bash
# 1. Configurar credenciales
cp .env.production .env

# 2. Iniciar con Docker
./deploy.sh start

# 3. Ver logs (para escanear QR de WhatsApp)
./deploy.sh logs
```

La aplicación estará en: **http://localhost:3000**

📖 **Guía completa Docker:** Ver [DOCKER.md](DOCKER.md)

### Comandos Docker

```bash
./deploy.sh start      # Iniciar
./deploy.sh stop       # Detener
./deploy.sh logs       # Ver logs
./deploy.sh backup     # Backup de BD
./deploy.sh restart    # Reiniciar
```

## 🛠️ Instalación Manual (Desarrollo)

### Requisitos
- Node.js 16+
- npm o yarn

### Pasos

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env con tus datos
```

3. **Iniciar el servidor:**
```bash
npm start
# O en desarrollo
npm run dev
```

4. **Abrir en el navegador:**
```
http://localhost:3000
```

5. **Escanear QR de WhatsApp:**
   - Revisa la consola del servidor
   - Escanea el QR con WhatsApp
   - Espera "✅ WhatsApp Web está listo y conectado"

## 🔐 Seguridad

### Credenciales por Defecto

**⚠️ CAMBIAR EN PRODUCCIÓN**

- **Desarrollo:** `admin` / `admin123`
- **Producción:** Ver [.env.production](.env.production)

### Características de Seguridad
- ✅ Autenticación obligatoria para admin
- ✅ Sesiones seguras (24 horas)
- ✅ Credenciales por defecto bloqueadas en producción
- ✅ Todas las rutas API protegidas

📖 **Guía completa:** Ver [SEGURIDAD.md](SEGURIDAD.md)

## 📧 Configuración de Email (Opcional)

Para Gmail:
1. Activar verificación en 2 pasos
2. Generar contraseña de aplicación
3. Configurar en `.env`:
   ```env
   EMAIL_USER=tu_email@gmail.com
   EMAIL_PASS=tu_contraseña_de_aplicación
   ```

## 📊 Base de Datos

SQLite con 4 tablas:
- **tickets**: Todos los tickets generados
- **servicios**: Catálogo de servicios (8 servicios)
- **notas**: Notas internas de técnicos
- **whatsapp_contactos**: Historial de contactos WhatsApp

## 📱 Flujo de Trabajo

1. **Cliente** accede a la web
2. Selecciona servicio y completa formulario
3. Recibe confirmación por email (con botones WhatsApp)
4. **Técnico** ve ticket en panel admin
5. Puede enviar WhatsApp con plantillas predefinidas
6. Asigna técnico y añade notas internas
7. Actualiza estado del ticket
8. Cliente puede consultar estado desde email

## 🎨 Panel de Administración

### Características:
- 📊 Estadísticas en tiempo real
- 🔍 Filtros por estado, servicio, prioridad
- 💬 WhatsApp Web embebido
- 📝 Notas internas por ticket
- 👤 Asignación de técnicos
- 📥 Exportar tickets a CSV
- 🔔 Notificaciones por email

### Acceso:
```
http://localhost:3000/admin
```

## 💬 WhatsApp Web Embebido

### Funcionalidades:
- Ver todos tus chats de WhatsApp
- Enviar/recibir mensajes desde la web
- Actualización automática cada 10 segundos
- Historial de conversaciones
- Plantillas de mensajes para técnicos

📖 **Guía completa:** Ver [WHATSAPP.md](WHATSAPP.md)

## 🚀 Despliegue en Producción

### Con Docker (Recomendado):
```bash
./deploy.sh start
```

### Manual:
```bash
NODE_ENV=production node server.js
```

### Con PM2:
```bash
pm2 start server.js --name myiatech-app --env production
pm2 save
```

📖 **Guía completa:** Ver [DESPLIEGUE.md](DESPLIEGUE.md)

## 📚 Documentación

- [DOCKER.md](DOCKER.md) - Despliegue con Docker
- [DESPLIEGUE.md](DESPLIEGUE.md) - Guía de despliegue general
- [SEGURIDAD.md](SEGURIDAD.md) - Seguridad y configuración
- [WHATSAPP.md](WHATSAPP.md) - Integración de WhatsApp

## 🔧 Development

### First time setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Create a user:**
    ```bash
    node create-user.js <username> <password> [nombre_completo] [email] [rol]
    ```
    Example:
    ```bash
    node create-user.js admin admin123 "Admin User" admin@example.com admin
    ```

3.  **Start the server:**
    ```bash
    npm run dev
    ```

### Running the application

1.  **Start the server:**
    ```bash
    npm run dev
    ```

2.  **Open in your browser:**
    [http://localhost:3000](http://localhost:3000)

### Estructura del Proyecto
```
├── server.js           # Servidor principal
├── database.js         # Gestión de BD
├── email.js           # Sistema de emails
├── whatsapp.js        # Integración WhatsApp Web
├── public/
│   ├── index.html     # Página principal
│   ├── admin.html     # Panel admin
│   ├── login.html     # Login admin
│   └── styles.css     # Estilos
├── Dockerfile         # Imagen Docker
├── docker-compose.yml # Orquestación Docker
└── deploy.sh         # Script de despliegue
```

## 🐛 Solución de Problemas

### Puerto 3000 en uso
```bash
lsof -ti:3000 | xargs kill -9
```

### WhatsApp no conecta
```bash
# Eliminar sesión y reconectar
rm -rf .wwebjs_auth
# Reiniciar y escanear nuevo QR
```

### Error de base de datos
```bash
# Respaldar y recrear
cp tickets.db tickets.backup.db
rm tickets.db
# Reiniciar servidor
```

## 📞 Contacto

- **Email:** info@myiatech.xyz
- **WhatsApp:** +34 624 620 893
- **Web:** http://localhost:3000

## 📝 Licencia

Todos los derechos reservados © 2026 MyiaTech

---

**Desarrollado con:** Node.js, Express, SQLite, whatsapp-web.js
**Última actualización:** 22 de enero de 2026
