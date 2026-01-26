# 📱 Guía de Integración de WhatsApp

## ✅ ¿Qué se ha implementado?

He integrado completamente WhatsApp en tu sistema de tickets para que los técnicos puedan contactar con los clientes directamente desde la web.

## 🎯 Funcionalidades Disponibles

### 1. **Botón rápido de WhatsApp en la lista de tickets**
- Cada ticket tiene un botón verde de WhatsApp <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="16">
- Clic rápido para abrir WhatsApp con el cliente

### 2. **Panel completo de WhatsApp en detalles del ticket**
Cuando abres un ticket, encontrarás una sección verde de WhatsApp con:

#### **Plantillas de mensajes predefinidas:**
- 📅 **Solicitar visita** - Para coordinar una cita
- 🔧 **Actualización de estado** - Informar progreso
- ✅ **Caso resuelto** - Confirmar resolución
- ℹ️ **Solicitar información** - Pedir más detalles

#### **Mensaje personalizado:**
- Campo de texto para escribir tu propio mensaje
- Las plantillas se cargan automáticamente al hacer clic

#### **Historial de contactos:**
- Ve quién contactó al cliente y cuándo
- Registro de todos los mensajes enviados
- Seguimiento completo de la comunicación

### 3. **Formateo automático de números**
El sistema formatea automáticamente los números de teléfono:
- Añade código de país (+34 para España)
- Elimina espacios y caracteres especiales
- Convierte números nacionales a formato internacional

## 📋 Cómo usar WhatsApp desde el panel

### Opción A: Botón rápido (desde la lista)
1. En la tabla de tickets, haz clic en el botón verde de WhatsApp
2. Se abrirá WhatsApp Web con un mensaje predeterminado
3. Modifica el mensaje si lo deseas y envía

### Opción B: Panel completo (desde detalles del ticket)

#### Crear un usuario

Para crear un usuario, ejecuta el siguiente comando:

```bash
node create-user.js <username> <password> [nombre_completo] [email] [rol]
```

Ejemplo:

```bash
node create-user.js admin admin123 "Admin User" admin@example.com admin
```

1.  Haz clic en "Ver" en cualquier ticket
2.  Desplázate a la sección verde "Contactar por WhatsApp"
3.  **Opciones:**
    -   Selecciona una plantilla (el mensaje se carga automáticamente)
    -   O escribe tu propio mensaje en el campo de texto
4.  Ingresa tu nombre en "Tu nombre (técnico)"
5.  Haz clic en "Abrir WhatsApp y Enviar Mensaje"
6.  WhatsApp Web se abrirá con el mensaje preparado
7.  El contacto quedará registrado en el historial

## 🔧 Características Técnicas

### Base de datos
Se ha creado la tabla `whatsapp_contactos` que registra:
- ID del ticket
- Teléfono contactado
- Mensaje enviado
- Técnico que realizó el contacto
- Fecha y hora del contacto

### API Endpoints
```
POST /api/tickets/:ticketId/whatsapp
- Registra un contacto de WhatsApp
- Body: { telefono, mensaje, enviado_por }

GET /api/tickets/:ticketId/whatsapp
- Obtiene historial de contactos WhatsApp del ticket
```

### Funciones JavaScript
- `sendWhatsApp(phone, ticketId, clientName)` - Envía mensaje con registro
- `openWhatsApp(phone, ticketId, clientName)` - Apertura rápida
- `setWhatsAppMessage(message)` - Carga plantilla
- `formatPhoneNumber(phone)` - Formatea número para WhatsApp

## 📱 Ejemplo de uso completo

1. **Cliente crea ticket** → ID: TKT-12345
2. **Técnico abre el ticket** en el panel admin
3. **Selecciona plantilla** "Solicitar visita"
4. **Personaliza el mensaje** si es necesario
5. **Ingresa su nombre** "Juan - Técnico"
6. **Hace clic** en "Abrir WhatsApp"
7. **WhatsApp Web se abre** con el mensaje preparado
8. **Envía el mensaje** al cliente
9. **El sistema registra** el contacto automáticamente
10. **Historial actualizado** - visible para todo el equipo

## 🎨 Ventajas de esta solución

✅ **Sin costos adicionales** - Usa WhatsApp Web estándar
✅ **Sin APIs de pago** - No requiere WhatsApp Business API
✅ **Fácil de usar** - Interfaz intuitiva
✅ **Historial completo** - Registro de todos los contactos
✅ **Plantillas predefinidas** - Mensajes profesionales
✅ **Personalizable** - Mensajes custom cuando los necesites
✅ **Formato automático** - Números siempre correctos
✅ **Integración total** - Todo desde el panel de tickets

## 🌐 Compatibilidad

- ✅ Funciona en todos los navegadores modernos
- ✅ Compatible con WhatsApp Web
- ✅ Compatible con WhatsApp Desktop
- ✅ Funciona en móviles (abre la app de WhatsApp)

## 🔐 Privacidad y Seguridad

- Los números de teléfono se almacenan de forma segura
- Solo los técnicos con acceso al panel pueden contactar clientes
- Historial de contactos auditable
- Cumple con prácticas estándar de WhatsApp

## 🚀 Próximos pasos sugeridos (opcionales)

Si en el futuro necesitas más funcionalidades:
1. **WhatsApp Business API** - Para envíos automáticos masivos
2. **Integración con Twilio** - Para mensajes programáticos
3. **Chatbot** - Respuestas automáticas
4. **Webhooks** - Recibir mensajes en el sistema

---

## 📞 Números de ejemplo que funcionan

El sistema detecta automáticamente:
- `666777888` → Convierte a `34666777888`
- `+34 666 777 888` → Limpia y usa `34666777888`
- `0666777888` → Convierte a `34666777888`
- `34666777888` → Usa directamente

---

**¡Tu sistema ya está listo para usar WhatsApp! 🎉**
