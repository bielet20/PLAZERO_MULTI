const nodemailer = require('nodemailer');
require('dotenv').config();

// Create email transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Send ticket confirmation to client
const sendTicketConfirmation = async (ticketData, servicios, prioridades) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: ticketData.email,
        subject: `Confirmación de Ticket ${ticketData.ticketId} - FONT MULTISERVEIS Y PLAZERO`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #2563eb, #1e40af); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .ticket-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .info-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
                    .info-label { font-weight: bold; width: 150px; color: #6b7280; }
                    .info-value { flex: 1; }
                    .priority-alta, .priority-urgente { color: #dc2626; font-weight: bold; }
                    .priority-media { color: #f59e0b; font-weight: bold; }
                    .priority-baja { color: #10b981; font-weight: bold; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
                    .btn { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Ticket Recibido</h1>
                        <p>Su solicitud ha sido registrada exitosamente</p>
                    </div>
                    <div class="content">
                        <p>Estimado/a <strong>${ticketData.nombre}</strong>,</p>
                        <p>Hemos recibido su solicitud de servicio y nuestro equipo técnico la revisará a la brevedad.</p>
                        
                        <div class="ticket-info">
                            <h2 style="margin-top: 0; color: #2563eb;">Detalles del Ticket</h2>
                            <div class="info-row">
                                <div class="info-label">Nº de Ticket:</div>
                                <div class="info-value"><strong>${ticketData.ticketId}</strong></div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">Servicio:</div>
                                <div class="info-value">${servicios[ticketData.servicio]}</div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">Prioridad:</div>
                                <div class="info-value"><span class="priority-${ticketData.prioridad}">${prioridades[ticketData.prioridad]}</span></div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">Estado:</div>
                                <div class="info-value">Pendiente</div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">Descripción:</div>
                                <div class="info-value">${ticketData.descripcion}</div>
                            </div>
                        </div>

                        <p><strong>Tiempo estimado de respuesta:</strong></p>
                        <ul>
                            <li>Urgente: 2-4 horas</li>
                            <li>Alta: 4-8 horas</li>
                            <li>Media: 24 horas</li>
                            <li>Baja: 48 horas</li>
                        </ul>

                        <p>Nos pondremos en contacto con usted al número <strong>${ticketData.telefono}</strong> o a este correo electrónico.</p>
                        
                        <div style="text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #25d366, #128c7e); border-radius: 10px;">
                            <h3 style="color: white; margin-top: 0;">📱 Contacto Directo por WhatsApp</h3>
                            <p style="color: white; margin-bottom: 20px;">Use WhatsApp para consultas rápidas sobre su ticket</p>
                            
                            <div style="display: grid; gap: 10px; max-width: 400px; margin: 0 auto;">
                                <a href="https://wa.me/34${process.env.COMPANY_PHONE || '654892803'}?text=Hola,%20tengo%20el%20ticket%20${ticketData.ticketId}%20y%20necesito%20consultar%20el%20estado" 
                                   style="background: white; color: #128c7e; font-weight: bold; text-decoration: none; display: block; padding: 12px 20px; border-radius: 8px; margin: 5px 0;">
                                    📊 Consultar Estado
                                </a>
                                <a href="https://wa.me/34${process.env.COMPANY_PHONE || '654892803'}?text=Hola,%20mi%20ticket%20${ticketData.ticketId}%20ya%20está%20resuelto.%20Por%20favor,%20pueden%20cerrarlo" 
                                   style="background: rgba(255,255,255,0.9); color: #128c7e; font-weight: bold; text-decoration: none; display: block; padding: 12px 20px; border-radius: 8px; margin: 5px 0;">
                                    ✅ Solicitar Cierre
                                </a>
                                <a href="https://wa.me/34${process.env.COMPANY_PHONE || '654892803'}?text=Hola,%20tengo%20una%20consulta%20sobre%20mi%20ticket%20${ticketData.ticketId}" 
                                   style="background: rgba(255,255,255,0.8); color: #128c7e; font-weight: bold; text-decoration: none; display: block; padding: 12px 20px; border-radius: 8px; margin: 5px 0;">
                                    💬 Consulta General
                                </a>
                            </div>
                        </div>
                        
                        <p style="margin-top: 30px;"><em>Guarde este número de ticket para futuras consultas: <strong>${ticketData.ticketId}</strong></em></p>
                    </div>
                    <div class="footer">
                        <p><strong>${process.env.COMPANY_NAME || 'FONT MULTISERVEIS Y PLAZERO'}</strong></p>
                        <p>Este es un mensaje automático, por favor no responda a este correo.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return transporter.sendMail(mailOptions);
};

// Send notification to support team
const sendNotificationToSupport = async (ticketData, servicios) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_TO,
        subject: `[${ticketData.prioridad.toUpperCase()}] Nuevo Ticket ${ticketData.ticketId}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
                    .ticket-details { background: #f9fafb; padding: 20px; border-radius: 8px; }
                    .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
                    .label { font-weight: bold; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>🎫 Nuevo Ticket Recibido</h2>
                    <div class="alert">
                        <strong>⚠️ Prioridad: ${ticketData.prioridad.toUpperCase()}</strong>
                    </div>
                    <div class="ticket-details">
                        <div class="detail-row"><span class="label">Ticket ID:</span> ${ticketData.ticketId}</div>
                        <div class="detail-row"><span class="label">Cliente:</span> ${ticketData.nombre}</div>
                        <div class="detail-row"><span class="label">Email:</span> ${ticketData.email}</div>
                        <div class="detail-row"><span class="label">Teléfono:</span> ${ticketData.telefono}</div>
                        <div class="detail-row"><span class="label">Servicio:</span> ${servicios[ticketData.servicio]}</div>
                        <div class="detail-row"><span class="label">Descripción:</span><br>${ticketData.descripcion}</div>
                    </div>
                    
                    <div style="margin: 20px 0; padding: 15px; background: #dcfce7; border-radius: 8px; border-left: 4px solid #25d366;">
                        <strong style="color: #166534;">📱 Acciones Rápidas:</strong><br>
                        <a href="https://wa.me/34${ticketData.telefono.replace(/\D/g, '')}?text=Hola%20${ticketData.nombre.replace(/ /g, '%20')},%20soy%20del%20servicio%20técnico.%20Hemos%20recibido%20tu%20ticket%20${ticketData.ticketId}%20sobre%20${servicios[ticketData.servicio].replace(/ /g, '%20')}" 
                           style="color: #25d366; font-weight: bold; text-decoration: none;">
                            💬 Contactar por WhatsApp
                        </a>
                        <span style="margin: 0 10px;">|</span>
                        <a href="tel:+34${ticketData.telefono.replace(/\D/g, '')}" style="color: #2563eb; font-weight: bold; text-decoration: none;">
                            📞 Llamar ahora
                        </a>
                    </div>
                    
                    <p style="margin-top: 20px;"><strong>Por favor, asignar y gestionar este ticket lo antes posible.</strong></p>
                </div>
            </body>
            </html>
        `
    };

    return transporter.sendMail(mailOptions);
};

// Send password reset email
const sendPasswordResetEmail = async (email, username, resetUrl) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Recuperación de Contraseña - FONT MULTISERVEIS Y PLAZERO',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                    .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Recuperación de Contraseña</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>${username}</strong>,</p>
                        <p>Has solicitado restablecer tu contraseña para el Panel de Administración de FONT MULTISERVEIS Y PLAZERO.</p>
                        <p>Haz clic en el siguiente botón para elegir una nueva contraseña. Este enlace caducará en 1 hora.</p>
                        
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="btn">Restablecer Contraseña</a>
                        </div>
                        
                        <p>Si no has solicitado este cambio, puedes ignorar este correo de forma segura.</p>
                        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                        <p>${resetUrl}</p>
                    </div>
                    <div class="footer">
                        <p><strong>${process.env.COMPANY_NAME || 'FONT MULTISERVEIS Y PLAZERO'}</strong></p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    return transporter.sendMail(mailOptions);
};

module.exports = {
    sendTicketConfirmation,
    sendNotificationToSupport,
    sendPasswordResetEmail
};
