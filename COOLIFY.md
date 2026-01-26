# Despliegue en Coolify

## Guía rápida de configuración

### 1. Crear nuevo servicio en Coolify

1. Accede a tu panel de Coolify
2. Crea un nuevo servicio tipo "Docker Image"
3. Conecta tu repositorio GitHub: `https://github.com/bielet20/webservices_ticket_whatsapp.git`

### 2. Configuración del servicio

#### Build Settings
- **Build Pack**: `Dockerfile`
- **Dockerfile Location**: `Dockerfile.coolify`
- **Docker Build Command**: `docker build --no-cache -f Dockerfile.coolify -t $IMAGE .`

#### General Settings
- **Port**: `3000`
- **Health Check Path**: `/api/health` (opcional)

### 3. Variables de entorno

Añade estas variables en la sección "Environment Variables" de Coolify:

```bash
# Servidor
NODE_ENV=production
PORT=3000

# Sesión
SESSION_SECRET=tu_clave_secreta_muy_larga_y_compleja_aqui

# Admin (CAMBIA ESTOS VALORES)
ADMIN_USERNAME=tu_usuario_admin
ADMIN_PASSWORD=tu_password_seguro

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_password_de_app
EMAIL_FROM=tu_email@gmail.com
```

### 4. Volumenes persistentes (IMPORTANTE)

Para que WhatsApp mantenga la sesión y la base de datos persista, configura estos volumenes en Coolify:

#### Volumen 1: Base de datos
- **Source**: `/var/lib/coolify/volumes/webservices/db`
- **Destination**: `/app/tickets.db`

#### Volumen 2: Sesión WhatsApp
- **Source**: `/var/lib/coolify/volumes/webservices/whatsapp`
- **Destination**: `/app/.wwebjs_auth`

### 5. Deployment

1.  **Crear un usuario:**
    Para crear un usuario, abre una consola en el contenedor de Coolify y ejecuta:
    ```bash
    node create-user.js <username> <password> [nombre_completo] [email] [rol]
    ```
    Ejemplo:
    ```bash
    node create-user.js admin admin123 "Admin User" admin@example.com admin
    ```

2.  **Deploy:**
    Haz clic en "Deploy"
    Coolify construirá la imagen Docker
    La primera vez, escanea los logs para ver el QR de WhatsApp:
    - Ve a la sección "Logs" del servicio
    - Verás el código QR en ASCII
    - Escanéalo con WhatsApp desde tu teléfono

### 6. Acceder a la aplicación

Una vez desplegado, Coolify te proporcionará una URL. Puedes:
- Configurar tu dominio personalizado en Coolify
- Acceder directamente a la app en la URL generada

**URLs importantes:**
- Panel admin: `https://tu-dominio.com/login.html`
- Panel público: `https://tu-dominio.com/`

### 7. Configuración de dominio (opcional)

En Coolify, ve a "Domains" y añade tu dominio:
- `servicios.myiatech.xyz` (o el dominio que prefieras)

Coolify generará automáticamente certificados SSL con Let's Encrypt.

## Troubleshooting

### El QR de WhatsApp no aparece
1. Ve a los logs del contenedor en Coolify
2. Busca "QR RECEIVED"
3. Si no aparece, revisa que los volumenes estén correctamente configurados

### Error de permisos
Si ves errores de permisos en los logs:
```bash
# Conéctate por SSH a tu servidor Coolify
ssh usuario@tu-servidor

# Ajusta permisos del volumen
sudo chown -R 1001:1001 /var/lib/coolify/volumes/webservices
```

### Base de datos no persiste
Verifica que el volumen de la base de datos esté correctamente montado:
- Source: directorio en el host
- Destination: `/app/tickets.db`

### WhatsApp se desconecta
Asegúrate de que el volumen `.wwebjs_auth` está persistiendo correctamente:
- Source: directorio en el host  
- Destination: `/app/.wwebjs_auth`

## Actualización

Para actualizar la aplicación:
1. Haz push de los cambios a tu repositorio GitHub
2. En Coolify, haz clic en "Redeploy"
3. Coolify reconstruirá y desplegará automáticamente

## Monitoreo

Coolify proporciona:
- **Logs en tiempo real**: Ver actividad de WhatsApp y solicitudes
- **Métricas de recursos**: CPU, RAM, disco
- **Health checks**: Estado del servicio

## Backup

### Base de datos
```bash
# Desde tu servidor Coolify
sudo cp /var/lib/coolify/volumes/webservices/db/tickets.db ~/backup-$(date +%Y%m%d).db
```

### Sesión WhatsApp
```bash
# Desde tu servidor Coolify
sudo tar -czf ~/whatsapp-backup-$(date +%Y%m%d).tar.gz \
  /var/lib/coolify/volumes/webservices/whatsapp
```

## Notas importantes

1. **Primera instalación**: La sesión de WhatsApp tardará unos 30-60 segundos en inicializarse
2. **Recursos**: Este servicio necesita al menos 512MB de RAM por Chromium
3. **Red**: Asegúrate de que el servidor tenga acceso a internet para WhatsApp Web
4. **Seguridad**: SIEMPRE cambia las credenciales por defecto antes de desplegar

## Soporte

Si encuentras problemas:
1. Revisa los logs en Coolify
2. Verifica las variables de entorno
3. Comprueba que los volumenes están correctamente configurados
4. Asegúrate de que el puerto 3000 no está siendo usado por otro servicio
