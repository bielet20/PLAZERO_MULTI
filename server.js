const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();

// Security imports
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const { sanitizeInput, sanitizeObject, validatePasswordStrength, validateEmail, validatePhone } = require('./security-utils');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('./email.js');

// Multer para upload de archivos
const multer = require('multer');
const uploadDir = path.join(__dirname, 'backups');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

const {
    initDatabase,
    createTicket,
    getAllTickets,
    getArchivedTickets,
    getTicketById,
    updateTicketStatus,
    updateTicket,
    archiveTicket,
    restoreTicket,
    deleteTicket,
    getTicketsByStatus,
    addNoteToTicket,
    archiveNote,
    restoreNote,
    deleteNote,
    getTicketNotes,
    assignTechnician,
    registerWhatsAppContact,
    getWhatsAppContacts,
    getAllServices,
    createService,
    updateService,
    deleteService,
    getAllUsers,
    getUserByUsername,
    createUser,
    updateUser,
    updateUserLastAccess,
    deleteUser,
    setPasswordResetToken,
    getUserByResetToken,
    clearResetToken,
    addHorasTrabajo,
    getHorasTrabajo,
    getHorasResumenPorTicket,
    getTotalHorasTicket,
    getHorasPorTecnico,
    updateHorasTrabajo,
    deleteHorasTrabajo,
    // Materiales
    getAllMaterials,
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    addMaterialToTicket,
    getMaterialsForTicket,
    removeMaterialFromTicket,
    // Facturación
    createInvoice,
    getInvoiceById,
    getInvoicesByTicketId,
    createMultiTicketInvoice,
    getTicketsForInvoice,
    getAllInvoices,
    presentarInvoice,
    updateInvoice,
    getDraftInvoicesByEmpresa,
    appendItemsToInvoice,
    deleteInvoice,
    // Empresas
    getAllEmpresas,
    getEmpresaById,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    transferirTicketEmpresa,
    // Clientes
    getAllClientes,
    getClienteById,
    createCliente,
    updateCliente,
    deleteCliente,
    // Citas
    createAppointment,
    getAppointmentsByTicket,
    getAppointmentsByTechnician,
    getAllAppointments,
    updateAppointmentStatus,
    deleteAppointment,
    // Backup & Restore
    exportAllData,
    restoreFromBackup
} = require('./database');

const {
    sendTicketConfirmation,
    sendNotificationToSupport
} = require('./email');

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Helmet middleware for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"], // Permitir event handlers inline
            imgSrc: ["'self'", "data:", "https:", "https://api.qrserver.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Security: Rate Limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos
    message: {
        success: false,
        message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
        error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 requests por minuto
    message: {
        error: 'Demasiadas solicitudes. Por favor, espere un momento.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const ticketCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // 10 tickets por hora por IP
    message: {
        error: 'Ha alcanzado el límite de tickets por hora. Intente más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cookie parser is required for csurf when using cookie-based tokens
const cookieParser = require('cookie-parser');
app.use(cookieParser());

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.error('FATAL ERROR: SESSION_SECRET is not set in production environment.');
    process.exit(1);
}

const csurf = require('csurf');

// ... (existing code)

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_secreto_temporal',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Cambiar nombre por defecto para mayor seguridad
    cookie: {
        httpOnly: true,
        // En producción real (con HTTPS), usar secure: true
        // Para pruebas locales en producción, permitir session sin HTTPS
        secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES === 'true',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
    }
}));

const csrfProtection = csurf({ cookie: true });

app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});


// Favicon handler
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    // Simple 1x1 transparent favicon
    res.send(Buffer.from([
        0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x01,
        0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x30, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00, 0x28, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x4C, 0xAF, 0x50, 0xFF, 0xFF, 0xFF
    ]));
});

// Initialize database
initDatabase()
    .then(() => {
        console.log('✓ Base de datos inicializada correctamente');
        // Auto-migrate admin credentials if needed
        return autoMigrateAdminCredentials();
    })
    .then(() => {
        console.log('✓ Migración de credenciales completada');
    })
    .catch(err => {
        console.error('Error al inicializar la base de datos:', err);
    });

// Auto-migrate admin credentials: hash plaintext passwords
const autoMigrateAdminCredentials = async () => {
    try {
        const adminUser = await getUserByUsername('admin');
        if (!adminUser) {
            console.log('⚠️  Usuario admin no encontrado, creando...');
            const defaultHash = await bcrypt.hash('Admin123!@#$', 10);
            await createUser('admin', defaultHash, 'Administrador', 'admin@local', '', 'admin');
            console.log('✓ Usuario admin creado con contraseña: Admin123!@#$');
            return;
        }

        // Check if password is already hashed (bcrypt hashes start with $2a$ or $2b$)
        if (!adminUser.password_hash.startsWith('$2')) {
            console.log('🔐 Detectado: contraseña sin hashear. Migrando...');
            const hashedPassword = await bcrypt.hash(adminUser.password_hash, 10);
            await updateUser(adminUser.id, { password_hash: hashedPassword });
            console.log('✓ Contraseña del admin migrada a formato seguro');
        } else {
            console.log('✓ Contraseña del admin ya está hasheada');
        }
    } catch (error) {
        console.error('Error en auto-migración:', error);
        // No throw - permite que el servidor siga iniciando
    }
};

// WhatsApp simplificado: solo enlaces directos a web.whatsapp.com
// Sin servidor de WhatsApp Web embebido para evitar problemas de Chromium en Docker

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    }

    // Si es una petición API, devolver error JSON
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({
            error: 'No autorizado. Inicie sesión para acceder a esta información.',
            requiresAuth: true
        });
    }

    // Si es una página, redirigir al login
    res.redirect('/login');
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
    const sessionState = {
        authenticated: req.session?.authenticated,
        rol: req.session?.rol,
        username: req.session?.username,
        timestamp: new Date().toISOString(),
        url: req.originalUrl,
        method: req.method
    };

    // Log to file for debugging
    try {
        fs.appendFileSync(path.join(__dirname, 'debug_session.log'), JSON.stringify(sessionState) + '\n');
    } catch (e) { }

    if (req.session && req.session.authenticated && req.session.rol === 'admin') {
        return next();
    }

    return res.status(403).json({
        error: 'Acceso denegado. Solo administradores pueden realizar esta acción.'
    });
};

// API Routes

// Login routes
app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    try {
        // Intentar autenticación con base de datos primero
        const user = await getUserByUsername(username);

        if (user && user.activo) {
            // Verificar contraseña hasheada
            const match = await bcrypt.compare(password, user.password_hash);

            if (match) {
                req.session.authenticated = true;
                req.session.username = username;
                req.session.userId = user.id;
                req.session.rol = user.rol;

                // Actualizar último acceso
                await updateUserLastAccess(username);

                // Security: Log de auditoría - Login exitoso
                logger.info('Login successful', {
                    username,
                    userId: user.id,
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    timestamp: new Date().toISOString()
                });

                return res.json({
                    success: true,
                    message: `✓ Bienvenido ${user.nombre_completo || username}`,
                    user: {
                        username: user.username,
                        nombre: user.nombre_completo,
                        rol: user.rol
                    }
                });
            }
        }

        // Security: Log de auditoría - Login fallido
        logger.warn('Login failed', {
            username,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString()
        });

        // Credenciales incorrectas
        res.status(401).json({
            success: false,
            message: 'Usuario o contraseña incorrectos'
        });

    } catch (error) {
        // Security: Log de error
        logger.error('Login error', {
            username,
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });

        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor'
        });
    }
});

app.post('/api/logout', csrfProtection, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
        }
        res.json({ success: true, message: 'Sesión cerrada' });
    });
});

// Create new ticket
app.post('/api/tickets', ticketCreationLimiter, csrfProtection, async (req, res) => {
    try {
        // Security: Sanitizar entrada
        const nombre = sanitizeInput(req.body.nombre);
        const email = req.body.email;
        const telefono = req.body.telefono;
        const servicio = req.body.servicio;
        const prioridad = req.body.prioridad || 'media';
        const descripcion = sanitizeInput(req.body.descripcion);

        // Validate required fields
        if (!nombre || !email || !telefono || !servicio || !descripcion) {
            return res.status(400).json({
                error: 'Todos los campos obligatorios deben ser completados'
            });
        }

        // Security: Validar email
        if (!validateEmail(email)) {
            return res.status(400).json({
                error: 'El email proporcionado no es válido'
            });
        }

        // Security: Validar teléfono
        if (!validatePhone(telefono)) {
            return res.status(400).json({
                error: 'El teléfono proporcionado no es válido'
            });
        }

        // Create ticket in database
        const result = await createTicket({
            nombre,
            email,
            telefono,
            servicio,
            prioridad,
            descripcion
        });

        const ticketData = {
            ticketId: result.ticketId,
            nombre,
            email,
            telefono,
            servicio,
            prioridad,
            descripcion
        };

        const allServices = await getAllServices();
        const servicesMap = allServices.reduce((acc, s) => {
            acc[s.codigo] = s.nombre;
            return acc;
        }, {});

        const prioritiesMap = {
            'baja': 'Baja',
            'media': 'Media',
            'alta': 'Alta',
            'urgente': 'Urgente'
        };

        // Send emails (don't wait for them to complete)
        Promise.all([
            sendTicketConfirmation(ticketData, servicesMap, prioritiesMap),
            sendNotificationToSupport(ticketData, servicesMap)
        ]).then(() => {
            console.log(`✓ Emails enviados para ticket ${result.ticketId}`);
        }).catch(err => {
            console.error('Error al enviar emails:', err);
            // Don't fail the request if email fails
        });

        // Security: Log de auditoría
        logger.info('Ticket created', {
            ticketId: result.ticketId,
            nombre,
            email,
            servicio,
            prioridad,
            ip: req.ip,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            success: true,
            ticketId: result.ticketId,
            message: 'Ticket creado exitosamente',
            whatsappUrl: `https://wa.me/34${process.env.COMPANY_PHONE || '654892803'}?text=Hola,%20tengo%20el%20ticket%20${result.ticketId}%20y%20necesito%20información`,
            telefono: process.env.COMPANY_PHONE || '654892803'
        });

    } catch (error) {
        logger.error('Error creating ticket', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });

        console.error('Error al crear ticket:', error);
        res.status(500).json({
            error: 'Error al procesar la solicitud. Por favor, inténtelo de nuevo.'
        });
    }
});

// Get all tickets
app.get('/api/tickets', requireAuth, csrfProtection, async (req, res) => {
    try {
        const tickets = await getAllTickets();
        res.json(tickets);
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
});

// Get ticket by ID
app.get('/api/tickets/:ticketId', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;

        const ticket = await getTicketById(ticketId);
        if (ticket) {
            res.json(ticket);
        } else {
            res.status(404).json({ error: `Ticket no encontrado: ${req.params.ticketId}` });
        }
    } catch (error) {
        console.error('Error al obtener ticket:', error);
        res.status(500).json({ error: 'Error al obtener ticket' });
    }
});

// Update ticket status
app.patch('/api/tickets/:ticketId/status', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { estado } = req.body;
        const validStates = ['pendiente', 'en_proceso', 'resuelto', 'cerrado'];

        if (!validStates.includes(estado)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        const result = await updateTicketStatus(req.params.ticketId, estado);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Estado actualizado' });
        } else {
            res.status(404).json({ error: `Ticket no encontrado: ${req.params.ticketId}` });
        }
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// Get tickets by status
app.get('/api/tickets/status/:estado', requireAuth, csrfProtection, async (req, res) => {
    try {
        const tickets = await getTicketsByStatus(req.params.estado);
        res.json(tickets);
    } catch (error) {
        console.error('Error al obtener tickets por estado:', error);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
});

// Add note to ticket
app.post('/api/tickets/:ticketId/notes', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { nota, autor } = req.body;
        if (!nota || !autor) {
            return res.status(400).json({ error: 'Nota y autor son requeridos' });
        }
        const result = await addNoteToTicket(req.params.ticketId, nota, autor);
        res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        console.error('Error al añadir nota:', error);
        res.status(500).json({ error: 'Error al añadir nota' });
    }
});

// Get notes for ticket
app.get('/api/tickets/:ticketId/notes', requireAuth, csrfProtection, async (req, res) => {
    try {
        const notes = await getTicketNotes(req.params.ticketId);
        res.json(notes);
    } catch (error) {
        console.error('Error al obtener notas:', error);
        res.status(500).json({ error: 'Error al obtener notas' });
    }
});

// ==================== HORAS DE TRABAJO ====================

// Add hours worked on ticket
app.post('/api/tickets/:ticketId/horas', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { usuarioId, tecnicoNombre, horas, descripcion } = req.body;

        if (!usuarioId || !tecnicoNombre || !horas) {
            return res.status(400).json({ error: 'Usuario, técnico y horas son requeridos' });
        }

        if (horas <= 0) {
            return res.status(400).json({ error: 'Las horas deben ser mayor a 0' });
        }

        const result = await addHorasTrabajo(
            ticketId,
            tecnicoNombre,
            horas,
            descripcion,
            usuarioId
        );

        res.json({
            success: true,
            message: 'Horas registradas exitosamente',
            id: result.id
        });
    } catch (error) {
        console.error('Error registrando horas:', error);
        res.status(500).json({ error: 'Error al registrar horas' });
    }
});

// Get hours worked on ticket
app.get('/api/tickets/:ticketId/horas', requireAuth, csrfProtection, async (req, res) => {
    try {
        const horas = await getHorasTrabajo(req.params.ticketId);
        const total = await getTotalHorasTicket(req.params.ticketId);
        const porTecnico = await getHorasResumenPorTicket(req.params.ticketId);

        res.json({
            horas: horas || [],
            total: total || 0,
            porTecnico: porTecnico || []
        });
    } catch (error) {
        console.error('Error al obtener horas:', error);
        res.status(500).json({ error: 'Error al obtener horas: ' + error.message });
    }
});

// Update hours entry
app.put('/api/tickets/horas/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { horas, descripcion } = req.body;

        if (!horas || horas <= 0) {
            return res.status(400).json({ error: 'Las horas deben ser mayor a 0' });
        }

        const result = await updateHorasTrabajo(req.params.id, horas, descripcion);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Horas actualizadas' });
        } else {
            res.status(404).json({ error: 'Registro de horas no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando horas:', error);
        res.status(500).json({ error: 'Error actualizando horas' });
    }
});

// Delete hours entry
app.delete('/api/tickets/horas/:id', requireAdmin, csrfProtection, async (req, res) => {
    try {
        const result = await deleteHorasTrabajo(req.params.id);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Registro de horas eliminado' });
        } else {
            res.status(404).json({ error: 'Registro de horas no encontrado' });
        }
    } catch (error) {
        console.error('Error eliminando horas:', error);
        res.status(500).json({ error: 'Error eliminando horas' });
    }
});

// Assign technician to ticket
app.patch('/api/tickets/:ticketId/assign', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { tecnico } = req.body;
        if (!tecnico) {
            return res.status(400).json({ error: 'Técnico es requerido' });
        }
        const result = await assignTechnician(req.params.ticketId, tecnico);
        if (result.changes > 0) {
            res.json({ success: true, message: 'Técnico asignado' });
        } else {
            const { ticketId } = req.params; // Define ticketId here
            res.status(404).json({ error: `Ticket no encontrado: ${ticketId}` });
        }
    } catch (error) {
        console.error('Error al asignar técnico:', error);
        res.status(500).json({ error: 'Error al asignar técnico' });
    }
});

// Update complete ticket (admin edit)
app.put('/api/tickets/:ticketId', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const ticketData = req.body;

        const result = await updateTicket(ticketId, ticketData);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Ticket actualizado exitosamente' });
        } else {
            res.status(404).json({ error: `Ticket no encontrado: ${ticketId}` });
        }
    } catch (error) {
        console.error('Error al actualizar ticket:', error);
        res.status(500).json({ error: 'Error al actualizar ticket' });
    }
});

// Delete ticket (admin only)
// Archive ticket (soft delete - admin only)
app.delete('/api/tickets/:ticketId', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const usuario = req.session.username;
        const result = await archiveTicket(ticketId, usuario);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Ticket archivado exitosamente' });
        } else {
            res.status(404).json({ error: `Ticket no encontrado: ${ticketId}` });
        }
    } catch (error) {
        console.error('Error al archivar ticket:', error);
        res.status(500).json({ error: 'Error al archivar ticket' });
    }
});

// Restore archived ticket (admin only)
app.post('/api/tickets/:ticketId/restore', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const result = await restoreTicket(ticketId);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Ticket restaurado exitosamente' });
        } else {
            res.status(404).json({ error: `Ticket no encontrado: ${ticketId}` });
        }
    } catch (error) {
        console.error('Error al restaurar ticket:', error);
        res.status(500).json({ error: 'Error al restaurar ticket' });
    }
});

// Get archived tickets
app.get('/api/tickets/archived/list', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const tickets = await getArchivedTickets();
        res.json(tickets);
    } catch (error) {
        console.error('Error al obtener tickets archivados:', error);
        res.status(500).json({ error: 'Error al obtener tickets archivados' });
    }
});

// Archive note (soft delete - admin only)
app.delete('/api/notes/:noteId', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { noteId } = req.params;
        const usuario = req.session.username;
        const result = await archiveNote(noteId, usuario);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Nota archivada exitosamente' });
        } else {
            res.status(404).json({ error: 'Nota no encontrada' });
        }
    } catch (error) {
        console.error('Error al archivar nota:', error);
        res.status(500).json({ error: 'Error al archivar nota' });
    }
});

// Restore archived note
app.post('/api/notes/:noteId/restore', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { noteId } = req.params;
        const result = await restoreNote(noteId);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Nota restaurada exitosamente' });
        } else {
            res.status(404).json({ error: 'Nota no encontrada' });
        }
    } catch (error) {
        console.error('Error al restaurar nota:', error);
        res.status(500).json({ error: 'Error al restaurar nota' });
    }
});

// Register WhatsApp contact
app.post('/api/tickets/:ticketId/whatsapp', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { telefono, mensaje, enviado_por } = req.body;
        if (!telefono || !enviado_por) {
            return res.status(400).json({ error: 'Teléfono y técnico son requeridos' });
        }
        const result = await registerWhatsAppContact(req.params.ticketId, telefono, mensaje, enviado_por);
        res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        console.error('Error al registrar contacto WhatsApp:', error);
        res.status(500).json({ error: 'Error al registrar contacto' });
    }
});

// Get WhatsApp contacts for ticket
app.get('/api/tickets/:ticketId/whatsapp', requireAuth, csrfProtection, async (req, res) => {
    try {
        const contacts = await getWhatsAppContacts(req.params.ticketId);
        res.json(contacts);
    } catch (error) {
        console.error('Error al obtener contactos WhatsApp:', error);
        res.status(500).json({ error: 'Error al obtener contactos' });
    }
});


// Admin panel route (simple HTML page for managing tickets)
app.get('/admin', requireAuth, csrfProtection, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Setup panel route (para cambiar credenciales)
app.get('/setup', csrfProtection, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// ==================== API SERVICIOS ====================

// Get all services
app.get('/api/servicios', requireAuth, csrfProtection, async (req, res) => {
    try {
        const servicios = await getAllServices();
        res.json(servicios);
    } catch (error) {
        console.error('Error obteniendo servicios:', error);
        res.status(500).json({ error: 'Error obteniendo servicios' });
    }
});

// Create service
app.post('/api/servicios', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { codigo, nombre, descripcion } = req.body;

        if (!codigo || !nombre) {
            return res.status(400).json({ error: 'Código y nombre son requeridos' });
        }

        const result = await createService(codigo, nombre, descripcion || '');
        res.json({ success: true, message: 'Servicio creado exitosamente', id: result.id });
    } catch (error) {
        console.error('Error creando servicio:', error);
        res.status(500).json({ error: 'Error creando servicio' });
    }
});

// Update service
app.put('/api/servicios/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, activo } = req.body;

        if (!codigo || !nombre) {
            return res.status(400).json({ error: 'Código y nombre son requeridos' });
        }

        const result = await updateService(id, codigo, nombre, descripcion || '', activo !== undefined ? activo : 1);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Servicio actualizado exitosamente' });
        } else {
            res.status(404).json({ error: 'Servicio no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando servicio:', error);
        res.status(500).json({ error: 'Error actualizando servicio' });
    }
});

// Delete service
app.delete('/api/servicios/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteService(id);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Servicio eliminado exitosamente' });
        } else {
            res.status(404).json({ error: 'Servicio no encontrado' });
        }
    } catch (error) {
        console.error('Error eliminando servicio:', error);
        res.status(500).json({ error: 'Error eliminando servicio' });
    }
});

// ==================== API CITAS / CALENDARIO ====================

// Get all appointments
app.get('/api/appointments', requireAuth, csrfProtection, async (req, res) => {
    try {
        let appointments;
        if (req.session.rol === 'admin') {
            appointments = await getAllAppointments();
        } else {
            appointments = await getAppointmentsByTechnician(req.session.userId);
        }
        res.json(appointments);
    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ error: 'Error al obtener citas' });
    }
});

// Create new appointment
app.post('/api/appointments', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { ticket_id, tecnico_id, fecha_cita, descripcion } = req.body;
        console.log('--- Creating Appointment ---');
        console.log('Body:', JSON.stringify(req.body));

        if (!ticket_id || !tecnico_id || !fecha_cita) {
            console.log('Validation failed: missing fields');
            return res.status(400).json({ error: 'Ticket, técnico y fecha son requeridos' });
        }

        const result = createAppointment({ ticket_id, tecnico_id, fecha_cita, descripcion });
        console.log('Database result:', JSON.stringify(result));

        // Trigger WhatsApp notification if WhatsApp is ready
        try {
            const whatsappService = require('./whatsapp');
            console.log('WhatsApp Service status:', whatsappService.isReady ? 'Ready' : 'Not Ready');

            if (whatsappService.isReady) {
                const users = getAllUsers();
                const technician = users.find(u => u.id === parseInt(tecnico_id));
                const ticket = getTicketById(ticket_id);

                console.log('Technician found:', technician ? technician.username : 'No');
                console.log('Ticket found:', ticket ? ticket.ticket_id : 'No');

                if (technician && technician.whatsapp && ticket) {
                    const message = `📅 *NUEVA CITA ASIGNADA*\n\n` +
                        `Ticket: ${ticket.ticket_id}\n` +
                        `Cliente: ${ticket.nombre}\n` +
                        `Fecha: ${new Date(fecha_cita).toLocaleString('es-ES')}\n` +
                        `Descripción: ${descripcion || 'Sin descripción'}\n` +
                        `Servicio: ${ticket.servicio}\n\n` +
                        `Por favor, confirma asistencia.`;

                    console.log('Sending WhatsApp to:', technician.whatsapp);
                    whatsappService.sendMessage(technician.whatsapp, message)
                        .then(() => console.log(`✓ Notificación de WhatsApp enviada al técnico ${technician.username}`))
                        .catch(err => console.error('Error sending WhatsApp message:', err));
                } else {
                    console.log('Skipping WhatsApp: Missing technician/whatsapp/ticket info');
                }
            }
        } catch (waError) {
            console.error('Error in WhatsApp logic (non-fatal):', waError);
        }

        res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        const errorDetail = `[${new Date().toISOString()}] CRITICAL Error creating appointment:\n${error.stack}\nBody: ${JSON.stringify(req.body)}\n\n`;
        try {
            fs.appendFileSync(path.join(__dirname, 'debug_appointment.log'), errorDetail);
        } catch (fsErr) {
            console.error('Failed to write to debug log:', fsErr);
        }

        console.error('CRITICAL Error creating appointment:');
        console.error(error);
        res.status(500).json({ error: 'Error al crear cita: ' + error.message });
    }
});

// Update appointment status
app.patch('/api/appointments/:id/status', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { estado } = req.body;
        const result = await updateAppointmentStatus(req.params.id, estado);
        if (result.changes > 0) {
            res.json({ success: true, message: 'Estado de cita actualizado' });
        } else {
            res.status(404).json({ error: 'Cita no encontrada' });
        }
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.status(500).json({ error: 'Error al actualizar cita' });
    }
});

// Delete appointment
app.delete('/api/appointments/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const result = await deleteAppointment(req.params.id);
        if (result.changes > 0) {
            res.json({ success: true, message: 'Cita eliminada' });
        } else {
            res.status(404).json({ error: 'Cita no encontrada' });
        }
    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ error: 'Error al eliminar cita' });
    }
});

// ==================== API MATERIALES ====================

// Get all materials
app.get('/api/materiales', requireAuth, csrfProtection, async (req, res) => {
    try {
        const materiales = await getAllMaterials();
        res.json(materiales);
    } catch (error) {
        console.error('Error obteniendo materiales:', error);
        res.status(500).json({ error: 'Error obteniendo materiales' });
    }
});

// Create material
app.post('/api/materiales', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { nombre, descripcion, precio } = req.body;
        if (!nombre || precio === undefined) {
            return res.status(400).json({ error: 'Nombre y precio son requeridos' });
        }
        const result = await createMaterial(nombre, descripcion || '', precio);
        res.json({ success: true, message: 'Material creado exitosamente', id: result.id });
    } catch (error) {
        console.error('Error creando material:', error);
        res.status(500).json({ error: 'Error creando material' });
    }
});

// Update material
app.put('/api/materiales/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio, activo } = req.body;

        if (!nombre || precio === undefined || activo === undefined) {
            return res.status(400).json({ error: 'Nombre, precio y estado de activación son requeridos' });
        }

        const result = await updateMaterial(id, nombre, descripcion || '', precio, activo);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Material actualizado exitosamente' });
        } else {
            res.status(404).json({ error: 'Material no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando material:', error);
        res.status(500).json({ error: 'Error actualizando material' });
    }
});

// Delete material
app.delete('/api/materiales/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteMaterial(id);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Material eliminado exitosamente' });
        } else {
            res.status(404).json({ error: 'Material no encontrado' });
        }
    } catch (error) {
        console.error('Error eliminando material:', error);
        res.status(500).json({ error: error.message });
    }
});


// ==================== TICKET-MATERIALES ====================

// Get materials for ticket
app.get('/api/tickets/:ticketId/materiales', requireAuth, csrfProtection, async (req, res) => {
    try {
        const materiales = await getMaterialsForTicket(req.params.ticketId);
        res.json(materiales);
    } catch (error) {
        console.error('Error obteniendo materiales del ticket:', error);
        res.status(500).json({ error: 'Error obteniendo materiales del ticket' });
    }
});

// Add material to ticket
app.post('/api/tickets/:ticketId/materiales', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { material_id, cantidad } = req.body;

        if (!material_id || !cantidad || cantidad <= 0) {
            return res.status(400).json({ error: 'ID de material y cantidad (mayor a 0) son requeridos.' });
        }

        // Get material to fetch current price
        const material = await getMaterialById(material_id);
        if (!material) {
            return res.status(404).json({ error: 'El material especificado no existe.' });
        }

        const result = await addMaterialToTicket(
            ticketId,
            material_id,
            cantidad,
            material.precio, // Use current price from inventory
            req.session.username
        );

        res.status(201).json({ success: true, message: 'Material añadido al ticket', id: result.id });

    } catch (error) {
        console.error('Error añadiendo material al ticket:', error);
        res.status(500).json({ error: 'Error añadiendo material al ticket' });
    }
});

// Remove material from ticket
app.delete('/api/tickets/materiales/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const result = await removeMaterialFromTicket(req.params.id);
        if (result.changes > 0) {
            res.json({ success: true, message: 'Material eliminado del ticket.' });
        } else {
            res.status(404).json({ error: 'Registro de material no encontrado.' });
        }
    } catch (error) {
        console.error('Error eliminando material del ticket:', error);
        res.status(500).json({ error: 'Error eliminando material del ticket' });
    }
});

// ==================== FACTURACIÓN ====================

app.post('/api/tickets/:ticketId/invoices', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { iva_percent = 21, fecha_vencimiento, targetInvoiceId } = req.body;

        // 1. Get ticket details
        const ticket = await getTicketById(ticketId);
        if (!ticket) {
            return res.status(404).json({ error: `Ticket no encontrado: ${ticketId}` });
        }

        // 2. Get worked hours and materials
        const horas = await getHorasTrabajo(ticketId);
        const materiales = await getMaterialsForTicket(ticketId);

        let subtotal = 0;
        const items = [];

        // Add worked hours to invoice items
        horas.forEach(h => {
            // Assuming a fixed price per hour for now, this can be improved
            const precioHora = process.env.PRICE_PER_HOUR || 50;
            items.push({
                concepto: `Horas de técnico: ${h.tecnico_nombre}`,
                descripcion: h.descripcion || `Horas trabajadas en el ticket ${ticketId}`,
                cantidad: h.horas,
                precio_unitario: precioHora,
                total: h.horas * precioHora
            });
            subtotal += h.horas * precioHora;
        });

        // Add materials to invoice items
        materiales.forEach(m => {
            items.push({
                concepto: `Material: ${m.nombre}`,
                descripcion: '',
                cantidad: m.cantidad,
                precio_unitario: m.precio_unitario,
                total: m.cantidad * m.precio_unitario
            });
            subtotal += m.cantidad * m.precio_unitario;
        });

        if (items.length === 0) {
            return res.status(400).json({ error: 'No hay elementos para facturar en este ticket (horas o materiales).' });
        }

        // 3. Calculate totals
        const iva = subtotal * (iva_percent / 100);
        const total = subtotal + iva;

        if (targetInvoiceId) {
            // Append items to existing invoice
            await appendItemsToInvoice(targetInvoiceId, items, ticketId);
            res.status(200).json({
                success: true,
                message: 'Elementos añadidos a la factura ' + targetInvoiceId,
                invoiceId: targetInvoiceId
            });
        } else {
            // Create new invoice
            let clienteInfo = {
                telefono: null,
                direccion: null,
                cif: null
            };

            // Try to look up client details from existing database
            try {
                const allClients = await getAllClientes();
                const matchedClient = allClients.find(c =>
                    (ticket.email && c.email && c.email.trim().toLowerCase() === ticket.email.trim().toLowerCase()) ||
                    (ticket.nombre && c.nombre && c.nombre.trim().toLowerCase() === ticket.nombre.trim().toLowerCase())
                );

                if (matchedClient) {
                    clienteInfo.telefono = matchedClient.telefono;
                    clienteInfo.direccion = matchedClient.direccion;
                    clienteInfo.cif = matchedClient.cif;
                }
            } catch (err) {
                console.error('Error looking up client details for invoice:', err);
            }

            const invoiceData = {
                ticket_id: ticketId,
                empresa_id: ticket.empresa_id || null,
                cliente_nombre: ticket.nombre,
                cliente_email: ticket.email,
                cliente_telefono: clienteInfo.telefono,
                cliente_direccion: clienteInfo.direccion,
                cliente_cif: clienteInfo.cif,
                fecha_vencimiento,
                subtotal,
                iva,
                total,
                items
            };

            const result = await createInvoice(invoiceData);

            res.status(201).json({
                success: true,
                message: 'Factura creada exitosamente',
                invoiceId: result.invoiceId
            });
        }

    } catch (error) {
        console.error('Error creando factura:', error);
        res.status(500).json({ error: 'Error interno al crear la factura.' });
    }
});

// Create multi-ticket invoice
app.post('/api/invoices/multi-ticket', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { ticket_ids, cliente_nombre, cliente_email, fecha_vencimiento, items, empresa_id } = req.body;

        if (!ticket_ids || ticket_ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos un ticket' });
        }

        if (!cliente_nombre || !items || items.length === 0) {
            return res.status(400).json({ error: 'Datos incompletos para la factura' });
        }

        // Calculate totals
        let subtotal = 0;
        for (const item of items) {
            subtotal += item.total || 0;
        }

        const iva_percent = 21;
        const iva = subtotal * (iva_percent / 100);
        const total = subtotal + iva;

        const invoiceData = {
            ticket_ids,
            cliente_nombre,
            cliente_email,
            fecha_vencimiento,
            subtotal,
            iva,
            total,
            items,
            empresa_id
        };

        const result = await createMultiTicketInvoice(invoiceData);

        res.status(201).json({
            success: true,
            message: 'Factura multi-ticket creada exitosamente',
            invoiceId: result.invoiceId,
            ticketCount: result.ticketCount
        });

    } catch (error) {
        console.error('Error creando factura multi-ticket:', error);
        res.status(500).json({ error: 'Error interno al crear la factura.' });
    }
});

// Get tickets for invoice creation
app.post('/api/invoices/tickets-summary', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { ticket_ids } = req.body;
        const tickets = await getTicketsForInvoice(ticket_ids);
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Error al obtener información de tickets' });
    }
});

app.get('/api/tickets/:ticketId/invoices', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const invoices = await getInvoicesByTicketId(ticketId);
        res.json(invoices);
    } catch (error) {
        console.error('Error obteniendo facturas:', error);
        res.status(500).json({ error: 'Error obteniendo facturas.' });
    }
});

app.get('/api/invoices/:invoiceId', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await getInvoiceById(invoiceId);
        if (invoice) {
            res.json(invoice);
        } else {
            res.status(404).json({ error: 'Factura no encontrada' });
        }
    } catch (error) {
        console.error('Error obteniendo factura:', error);
        res.status(500).json({ error: 'Error obteniendo factura.' });
    }
});

// Get all invoices
app.get('/api/facturas', requireAuth, csrfProtection, async (req, res) => {
    try {
        const invoices = await getAllInvoices();
        res.json(invoices);
    } catch (error) {
        console.error('Error obteniendo facturas:', error);
        res.status(500).json({ error: 'Error obteniendo facturas.' });
    }
});

// Present invoice (mark as submitted and lock it)
app.put('/api/facturas/:id/presentar', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await presentarInvoice(id);
        res.json({ success: true, message: 'Factura presentada y bloqueada exitosamente', changes: result.changes });
    } catch (error) {
        console.error('Error presentando factura:', error);
        res.status(error.message.includes('bloqueada') ? 403 : 500).json({ error: error.message });
    }
});

// Update invoice (only if not locked)
app.put('/api/facturas/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const { cliente_nombre, cliente_email, fecha_vencimiento, items, estado } = req.body;
        const result = await updateInvoice(id, { cliente_nombre, cliente_email, fecha_vencimiento, items, estado });
        res.json({ success: true, message: 'Factura actualizada exitosamente', changes: result.changes });
    } catch (error) {
        console.error('Error actualizando factura:', error);
        res.status(error.message.includes('bloqueada') ? 403 : 500).json({ error: error.message });
    }
});

// Delete invoice (only if not locked)
app.delete('/api/facturas/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteInvoice(id);
        res.json({ success: true, message: 'Factura eliminada exitosamente', changes: result.changes });
    } catch (error) {
        console.error('Error eliminando factura:', error);
        res.status(error.message.includes('bloqueada') ? 403 : 500).json({ error: error.message });
    }
});

// ==================== API CLIENTES ====================

// Get all clientes
app.get('/api/clientes', requireAuth, csrfProtection, async (req, res) => {
    try {
        const clientes = await getAllClientes();
        res.json(clientes);
    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        res.status(500).json({ error: 'Error obteniendo clientes' });
    }
});

// Get cliente by ID
app.get('/api/clientes/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const cliente = await getClienteById(req.params.id);
        if (cliente) {
            res.json(cliente);
        } else {
            res.status(404).json({ error: 'Cliente no encontrado' });
        }
    } catch (error) {
        console.error('Error obteniendo cliente:', error);
        res.status(500).json({ error: 'Error obteniendo cliente' });
    }
});

// Create cliente
app.post('/api/clientes', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { nombre, email, telefono, direccion, cif, empresa_id } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        const result = await createCliente({ nombre, email, telefono, direccion, cif, empresa_id });
        res.status(201).json({ id: result.id, message: 'Cliente creado correctamente' });
    } catch (error) {
        console.error('Error creando cliente:', error);
        res.status(500).json({ error: 'Error creando cliente' });
    }
});

// Update cliente
app.put('/api/clientes/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const result = await updateCliente(req.params.id, req.body);
        if (result.changes > 0) {
            res.json({ success: true, message: 'Cliente actualizado correctamente' });
        } else {
            res.status(404).json({ error: 'Cliente no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando cliente:', error);
        res.status(500).json({ error: 'Error actualizando cliente' });
    }
});

// Delete cliente
app.delete('/api/clientes/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const result = await deleteCliente(req.params.id);
        if (result.changes > 0) {
            res.json({ success: true, message: 'Cliente eliminado correctamente' });
        } else {
            res.status(404).json({ error: 'Cliente no encontrado' });
        }
    } catch (error) {
        console.error('Error eliminando cliente:', error);
        res.status(500).json({ error: 'Error eliminando cliente' });
    }
});

// ==================== API EMPRESAS ====================

// Get all empresas
app.get('/api/empresas', requireAuth, csrfProtection, async (req, res) => {
    try {
        const empresas = await getAllEmpresas();
        res.json(empresas);
    } catch (error) {
        console.error('Error obteniendo empresas:', error);
        res.status(500).json({ error: 'Error obteniendo empresas' });
    }
});

// Get empresa by ID
app.get('/api/empresas/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const empresa = await getEmpresaById(req.params.id);
        if (empresa) {
            res.json(empresa);
        } else {
            res.status(404).json({ error: 'Empresa no encontrada' });
        }
    } catch (error) {
        console.error('Error obteniendo empresa:', error);
        res.status(500).json({ error: 'Error obteniendo empresa' });
    }
});

// Get draft invoices for an empresa
app.get('/api/empresas/:id/invoices/draft', requireAuth, csrfProtection, async (req, res) => {
    try {
        const invoices = await getDraftInvoicesByEmpresa(req.params.id);
        res.json(invoices);
    } catch (error) {
        console.error('Error obteniendo facturas borrador:', error);
        res.status(500).json({ error: 'Error obteniendo facturas borrador' });
    }
});

// Create empresa
app.post('/api/empresas', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { nombre, cif, direccion, telefono, email, verifactu } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'Nombre es requerido' });
        }

        const result = await createEmpresa(nombre, cif || '', direccion || '', telefono || '', email || '', verifactu !== undefined ? verifactu : 1);
        res.json({ success: true, message: 'Empresa creada exitosamente', id: result.id });
    } catch (error) {
        console.error('Error creando empresa:', error);
        res.status(500).json({ error: 'Error creando empresa' });
    }
});

// Update empresa
app.put('/api/empresas/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, cif, direccion, telefono, email, activo, verifactu } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'Nombre es requerido' });
        }

        const result = await updateEmpresa(id, nombre, cif || '', direccion || '', telefono || '', email || '', activo !== undefined ? activo : 1, verifactu !== undefined ? verifactu : 1);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Empresa actualizada exitosamente' });
        } else {
            res.status(404).json({ error: 'Empresa no encontrada' });
        }
    } catch (error) {
        console.error('Error actualizando empresa:', error);
        res.status(500).json({ error: 'Error actualizando empresa' });
    }
});

// Delete empresa
app.delete('/api/empresas/:id', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteEmpresa(id);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Empresa eliminada exitosamente' });
        } else {
            res.status(404).json({ error: 'Empresa no encontrada' });
        }
    } catch (error) {
        console.error('Error eliminando empresa:', error);
        res.status(500).json({ error: error.message });
    }
});

// Transfer ticket to another empresa
app.post('/api/tickets/:ticketId/transferir-empresa', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { empresa_id } = req.body;

        if (!empresa_id) {
            return res.status(400).json({ error: 'ID de empresa es requerido' });
        }

        const result = await transferirTicketEmpresa(ticketId, empresa_id);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Ticket transferido exitosamente' });
        } else {
            res.status(404).json({ error: `Ticket no encontrado: ${ticketId}` });
        }
    } catch (error) {
        console.error('Error transfiriendo ticket:', error);
        res.status(500).json({ error: 'Error transfiriendo ticket' });
    }
});

// ==================== API USUARIOS ====================

// Get all users
app.get('/api/usuarios', requireAuth, csrfProtection, async (req, res) => {
    try {
        const usuarios = await getAllUsers();
        res.json(usuarios);
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
});

// Create new user
app.post('/api/usuarios', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { username, password, nombre_completo, email, whatsapp, rol } = req.body;

        // Validar datos requeridos
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
        }

        console.log('[CREATE USER] Password received:', password, 'Length:', password.length);

        // Security: Validar fortaleza de contraseña
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                error: 'La contraseña no cumple con los requisitos de seguridad',
                details: passwordValidation.errors
            });
        }

        // Security: Validar email si se proporciona
        if (email && !validateEmail(email)) {
            return res.status(400).json({ error: 'El email proporcionado no es válido' });
        }

        // Verificar que el usuario no exista
        const existingUser = await getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        // Hash de la contraseña
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Security: Sanitizar entrada
        const sanitizedUsername = sanitizeInput(username);
        const sanitizedNombreCompleto = nombre_completo ? sanitizeInput(nombre_completo) : null;

        // Crear usuario
        const result = await createUser(sanitizedUsername, passwordHash, sanitizedNombreCompleto, email, whatsapp, rol || 'tecnico');

        // Security: Log de auditoría
        logger.info('User created', {
            username: sanitizedUsername,
            rol: rol || 'tecnico',
            createdBy: req.session.username,
            ip: req.ip,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Usuario creado exitosamente',
            id: result.id
        });
    } catch (error) {
        logger.error('Error creating user', {
            error: error.message,
            createdBy: req.session.username,
            ip: req.ip
        });

        console.error('Error creando usuario:', error);
        res.status(500).json({ error: 'Error creando usuario' });
    }
});

// Update user
app.put('/api/usuarios/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_completo, email, whatsapp, rol, activo, password } = req.body;

        const updateData = { nombre_completo, email, whatsapp, rol, activo };

        // If se proporciona nueva contraseña, validarla y hashearla
        if (password) {
            const passwordValidation = validatePasswordStrength(password);
            if (!passwordValidation.valid) {
                return res.status(400).json({
                    error: 'La contraseña no cumple con los requisitos de seguridad',
                    details: passwordValidation.errors
                });
            }
            const saltRounds = 10;
            updateData.password_hash = await bcrypt.hash(password, saltRounds);
        }

        const result = await updateUser(id, updateData);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Usuario actualizado exitosamente' });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: 'Error actualizando usuario' });
    }
});

// Delete user
app.delete('/api/usuarios/:id', requireAuth, csrfProtection, async (req, res) => {
    try {
        const { id } = req.params;

        // No permitir eliminar al propio usuario
        if (req.session.userId == id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        const result = await deleteUser(id);

        if (result.changes > 0) {
            res.json({ success: true, message: 'Usuario eliminado exitosamente' });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error eliminando usuario' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    // No inicializar WhatsApp automáticamente - esperar a que el usuario lo solicite
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get session info (verificar rol del usuario actual)
app.get('/api/session', csrfProtection, (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({
            authenticated: true,
            username: req.session.username,
            rol: req.session.rol,
            isAdmin: req.session.rol === 'admin'
        });
    } else {
        res.json({
            authenticated: false,
            rol: null,
            isAdmin: false
        });
    }
});

// Debug endpoint to check session and user details
app.get('/api/debug-session', requireAuth, async (req, res) => {
    try {
        const user = await getUserByUsername(req.session.username);
        res.json({
            session: {
                authenticated: req.session.authenticated,
                username: req.session.username,
                userId: req.session.userId,
                rol: req.session.rol
            },
            database: {
                id: user?.id,
                username: user?.username,
                rol: user?.rol,
                activo: user?.activo
            },
            checks: {
                isAuthenticated: !!(req.session && req.session.authenticated),
                hasAdminRole: req.session.rol === 'admin',
                wouldPassRequireAdmin: !!(req.session && req.session.authenticated && req.session.rol === 'admin')
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Diagnostic endpoint for setup
app.get('/api/setup/check', csrfProtection, async (req, res) => {
    try {
        const adminUser = await getUserByUsername('admin');

        if (!adminUser) {
            return res.json({
                status: 'error',
                message: 'Usuario admin no encontrado',
                needsSetup: true
            });
        }

        const isHashed = adminUser.password_hash.startsWith('$2');

        res.json({
            status: 'ok',
            adminExists: true,
            passwordHashed: isHashed,
            message: isHashed ? 'Admin existe con contraseña hasheada' : 'Admin existe pero contraseña no está hasheada'
        });
    } catch (error) {
        console.error('Error en setup check:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Diagnostic endpoint for work hours table
app.get('/api/diagnostics/horas', csrfProtection, async (req, res) => {
    try {
        const { db } = require('./database');

        // Check if table exists
        const tableCheck = new Promise((resolve) => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='horas_trabajo'`, (err, row) => {
                resolve({ tableExists: !!row, error: err ? err.message : null });
            });
        });

        const result = await tableCheck;

        res.json({
            status: result.tableExists ? 'ok' : 'missing',
            horasTableExists: result.tableExists,
            message: result.tableExists ? 'Tabla horas_trabajo existe' : 'Tabla horas_trabajo no existe',
            error: result.error
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// ========== BACKUP ENDPOINTS ==========

// List all backups
app.get('/api/backups', requireAuth, csrfProtection, async (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            return res.json({ backups: [] });
        }

        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.tar.gz') || f.endsWith('.json'))
            .sort()
            .reverse();

        const backups = files.map(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            const infoPath = path.join(backupDir, file.replace('.tar.gz', '_info.json'));
            let info = {};

            if (fs.existsSync(infoPath)) {
                try {
                    info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                } catch (e) { }
            }

            return {
                name: file,
                size: stats.size,
                sizeReadable: file.endsWith('.json')
                    ? (stats.size / 1024).toFixed(2) + ' KB'
                    : (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                created: stats.mtime.toISOString(),
                createdReadable: stats.mtime.toLocaleString('es-ES'),
                info: info
            };
        });

        res.json({ backups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create backup now
app.post('/api/backups/create', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `backup_${timestamp}.json`;
        const backupDir = path.join(__dirname, 'backups');
        const backupFile = path.join(backupDir, filename);

        // Exportar todos los datos
        const data = exportAllData();
        const backup = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            note: 'Backup completo - Base de datos en memoria',
            data: data
        };

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
        const stats = fs.statSync(backupFile);

        const responseData = {
            success: true,
            message: 'Backup creado exitosamente',
            backup: {
                name: filename,
                size: stats.size,
                sizeReadable: (stats.size / 1024).toFixed(2) + ' KB',
                created: new Date().toISOString()
            }
        };

        // Si el cliente solicita descarga inmediata
        if (req.query.download === 'true') {
            return res.download(backupFile, filename);
        }

        res.json(responseData);
    } catch (error) {
        console.error('❌ Error durante el backup:', error.message);
        res.status(500).json({
            error: 'Error al crear backup: ' + error.message
        });
    }
});

// Download backup
app.get('/api/backups/download/:filename', requireAuth, csrfProtection, (req, res) => {
    try {
        const filename = req.params.filename;
        // Validar que el filename no intente salir del directorio
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Nombre de archivo inválido' });
        }

        const filePath = path.join(__dirname, 'backups', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        // Enviar archivo para descargar
        res.download(filePath, filename, (err) => {
            if (err) console.error('Error descargando:', err);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload and restore backup
app.post('/api/backups/restore', requireAuth, requireAdmin, upload.single('backupFile'), csrfProtection, async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const backupContent = fs.readFileSync(file.path, 'utf8');
        let backupData;
        try {
            backupData = JSON.parse(backupContent);
        } catch (e) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'El archivo no es un JSON válido' });
        }

        // Validación básica
        if (!backupData.data || !backupData.data.usuarios) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'El backup no tiene el formato correcto' });
        }

        // Restaurar
        restoreFromBackup(backupData.data);

        // Mover a la carpeta de backups para referencia futura
        const backupDir = path.join(__dirname, 'backups');
        const finalPath = path.join(backupDir, file.originalname);
        fs.renameSync(file.path, finalPath);

        res.json({
            success: true,
            message: 'Backup restaurado correctamente',
            file: file.originalname
        });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Error al restaurar backup: ' + error.message });
    }
});

// Restore from existing backup file
app.post('/api/backups/restore/:filename', requireAuth, requireAdmin, csrfProtection, async (req, res) => {
    try {
        const filename = req.params.filename;
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Nombre de archivo inválido' });
        }

        const filePath = path.join(__dirname, 'backups', filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        const backupContent = fs.readFileSync(filePath, 'utf8');
        let backupData;
        try {
            backupData = JSON.parse(backupContent);
        } catch (e) {
            return res.status(400).json({ error: 'El archivo no es un JSON válido' });
        }

        // Validación básica
        if (!backupData.data || !backupData.data.usuarios) {
            return res.status(400).json({ error: 'El backup no tiene el formato correcto' });
        }

        // Restaurar
        restoreFromBackup(backupData.data);

        res.json({
            success: true,
            message: 'Backup restaurado correctamente desde el archivo: ' + filename
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al restaurar backup: ' + error.message });
    }
});

// Delete backup
app.delete('/api/backups/:filename', requireAuth, requireAdmin, csrfProtection, (req, res) => {
    try {
        const filename = req.params.filename;

        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Nombre de archivo inválido' });
        }

        const filePath = path.join(__dirname, 'backups', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup no encontrado' });
        }

        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: 'Backup eliminado exitosamente'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Forgot Password - Generate token and send email
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'El usuario es obligatorio' });
        }

        const user = await getUserByUsername(username);
        if (!user || !user.email) {
            // Security: Don't reveal if user exists or has email
            return res.json({
                success: true,
                message: 'Si el usuario existe y tiene un correo configurado, recibirás instrucciones brevemente.'
            });
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        await setPasswordResetToken(username, token, expires);

        // Send email
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
        await sendPasswordResetEmail(user.email, user.username, resetUrl);

        res.json({
            success: true,
            message: 'Si el usuario existe y tiene un correo configurado, recibirás instrucciones brevemente.'
        });
    } catch (error) {
        console.error('Error in forgot-password:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud de recuperación' });
    }
});

// Reset Password - Verify token and update password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
        }

        // Validate password
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                error: 'La contraseña no cumple con los requisitos de seguridad',
                details: passwordValidation.errors
            });
        }

        const user = await getUserByResetToken(token);
        if (!user) {
            return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha caducado' });
        }

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Update user
        await updateUser(user.id, { password_hash: passwordHash });
        await clearResetToken(user.username);

        res.json({
            success: true,
            message: 'Contraseña actualizada correctamente'
        });
    } catch (error) {
        console.error('Error in reset-password:', error);
        res.status(500).json({ error: 'Error al restablecer la contraseña' });
    }
});

// Update production credentials (admin password)
app.post('/api/setup/update-admin-password', csrfProtection, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        // Obtener usuario admin
        const adminUser = await getUserByUsername('admin');
        if (!adminUser) {
            return res.status(500).json({ error: 'Usuario admin no encontrado en la base de datos' });
        }

        // Verificar contraseña actual
        // Check if password is hashed or plaintext
        let isPasswordValid = false;

        if (adminUser.password_hash.startsWith('$2')) {
            // Password is hashed, use bcrypt
            isPasswordValid = await bcrypt.compare(currentPassword, adminUser.password_hash);
        } else {
            // Password is plaintext (migration case), compare directly
            isPasswordValid = currentPassword === adminUser.password_hash;
        }

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        // Validar nueva contraseña
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });
        }

        // Hashear nueva contraseña
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Actualizar en la base de datos
        const result = await updateUser(adminUser.id, { password_hash: passwordHash });

        if (result.changes > 0) {
            res.json({
                success: true,
                message: 'Contraseña del admin actualizada exitosamente'
            });
        } else {
            res.status(500).json({ error: 'No se pudo actualizar la contraseña' });
        }
    } catch (error) {
        console.error('Error actualizando contraseña admin:', error);
        res.status(500).json({ error: 'Error interno: ' + error.message });
    }
});

// Create Root user (one-time setup)
app.post('/api/setup/create-root-user', csrfProtection, async (req, res) => {
    try {
        const { adminPassword, rootPassword } = req.body;

        if (!adminPassword || !rootPassword) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        // Obtener usuario admin para validar
        const adminUser = await getUserByUsername('admin');
        if (!adminUser) {
            return res.status(500).json({ error: 'Usuario admin no encontrado' });
        }

        // Verificar contraseña admin
        // Check if password is hashed or plaintext
        let isPasswordValid = false;

        if (adminUser.password_hash.startsWith('$2')) {
            // Password is hashed, use bcrypt
            isPasswordValid = await bcrypt.compare(adminPassword, adminUser.password_hash);
        } else {
            // Password is plaintext (migration case), compare directly
            isPasswordValid = adminPassword === adminUser.password_hash;
        }

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Contraseña del admin incorrecta' });
        }

        // Verificar si Root ya existe
        const existingRoot = await getUserByUsername('Root');
        if (existingRoot) {
            return res.status(400).json({ error: 'El usuario Root ya existe' });
        }

        // Validar contraseña de Root
        if (rootPassword.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // Crear usuario Root
        const saltRounds = 10;
        const rootHash = await bcrypt.hash(rootPassword, saltRounds);

        const newRoot = await createUser(
            'Root',
            rootHash,
            'Root Administrator',
            'root@admin.local',
            '', // whatsapp
            'admin'
        );

        res.json({
            success: true,
            message: 'Usuario Root creado exitosamente',
            id: newRoot.id
        });
    } catch (error) {
        console.error('Error creando usuario Root:', error);
        res.status(500).json({ error: 'Error interno: ' + error.message });
    }
});

// Debug endpoint (solo para verificar configuración)
app.get('/api/config-check', (req, res) => {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const hasPassword = !!(process.env.ADMIN_PASSWORD);
    const isProduction = process.env.NODE_ENV === 'production';

    res.json({
        environment: process.env.NODE_ENV || 'development',
        usernameConfigured: username,
        passwordConfigured: hasPassword,
        isProduction: isProduction,
        defaultBlocked: isProduction && username === 'admin'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('--- GLOBAL ERROR ---');
    console.error(err.stack);

    // Log to file if possible
    try {
        fs.appendFileSync(path.join(__dirname, 'global_errors.log'), `[${new Date().toISOString()}] ${err.stack}\n\n`);
    } catch (fsErr) { }

    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Error de validación CSRF (sesión expirada o inválida). Por favor, recarga la página.' });
    }

    res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Gestión de incidencias FONT MULTISERVEIS Y PLAZERO iniciado');
    console.log('='.repeat(50));
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📊 Panel Admin: http://localhost:${PORT}/admin`);
    console.log(`📧 Email configurado: ${process.env.EMAIL_USER || 'No configurado'}`);
    console.log('='.repeat(50) + '\n');
});

module.exports = app;
