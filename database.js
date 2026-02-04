const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// SOLUCIÓN: Base de datos en memoria (temporal hasta resolver permisos de macOS)
// Los datos se perderán al reiniciar el servidor
const db = new Database(':memory:');

console.log('⚠️  Usando base de datos EN MEMORIA (los datos se perderán al reiniciar)');

// Initialize database
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        try {
            // Create tickets table
            db.exec(`
                CREATE TABLE IF NOT EXISTS tickets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT UNIQUE NOT NULL,
                    nombre TEXT NOT NULL,
                    email TEXT NOT NULL,
                    telefono TEXT NOT NULL,
                    servicio TEXT NOT NULL,
                    prioridad TEXT NOT NULL,
                    descripcion TEXT NOT NULL,
                    estado TEXT DEFAULT 'pendiente',
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    archivado INTEGER DEFAULT 0,
                    fecha_archivado DATETIME,
                    usuario_archivado TEXT
                )
            `);

            // Create services table
            db.exec(`
                CREATE TABLE IF NOT EXISTS servicios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    codigo TEXT UNIQUE NOT NULL,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    activo INTEGER DEFAULT 1,
                    archivado INTEGER DEFAULT 0,
                    fecha_archivado DATETIME,
                    usuario_archivado TEXT
                )
            `);

            // Create notes table
            db.exec(`
                CREATE TABLE IF NOT EXISTS notas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    nota TEXT NOT NULL,
                    autor TEXT NOT NULL,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    archivado INTEGER DEFAULT 0,
                    fecha_archivado DATETIME,
                    usuario_archivado TEXT,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
                )
            `);

            // Create users table
            db.exec(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    nombre_completo TEXT,
                    email TEXT,
                    rol TEXT DEFAULT 'tecnico',
                    activo INTEGER DEFAULT 1,
                    ultimo_acceso DATETIME,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create empresas table
            db.exec(`
                CREATE TABLE IF NOT EXISTS empresas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    cif TEXT,
                    direccion TEXT,
                    telefono TEXT,
                    email TEXT,
                    activo INTEGER DEFAULT 1,
                    verifactu INTEGER DEFAULT 1,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create materiales table
            db.exec(`
                CREATE TABLE IF NOT EXISTS materiales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    precio REAL NOT NULL DEFAULT 0,
                    activo INTEGER DEFAULT 1,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create whatsapp_contactos table
            db.exec(`
                CREATE TABLE IF NOT EXISTS whatsapp_contactos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    telefono TEXT NOT NULL,
                    mensaje TEXT,
                    enviado_por TEXT NOT NULL,
                    fecha_contacto DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
                )
            `);

            // Create facturas table
            db.exec(`
                CREATE TABLE IF NOT EXISTS facturas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT,
                    empresa_id INTEGER,
                    numero_factura TEXT,
                    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
                    total REAL DEFAULT 0,
                    estado TEXT DEFAULT 'borrador',
                    presentada INTEGER DEFAULT 0,
                    fecha_presentacion DATETIME,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
                )
            `);

            // Create horas_trabajo table
            db.exec(`
                CREATE TABLE IF NOT EXISTS horas_trabajo (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    tecnico TEXT NOT NULL,
                    horas REAL NOT NULL,
                    descripcion TEXT,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
                )
            `);

            // Create factura_tickets table (relación muchos a muchos)
            db.exec(`
                CREATE TABLE IF NOT EXISTS factura_tickets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    factura_id TEXT NOT NULL,
                    ticket_id TEXT NOT NULL,
                    tipo_trabajo TEXT DEFAULT 'servicio', -- oficial, ayudante, servicio
                    horas_oficiales REAL DEFAULT 0,
                    horas_ayudante REAL DEFAULT 0,
                    precio_oficial REAL DEFAULT 0,
                    precio_ayudante REAL DEFAULT 0,
                    FOREIGN KEY (factura_id) REFERENCES facturas(factura_id),
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
                )
            `);
            console.log('✓ Tabla de factura_tickets creada/verificada');

            // Create appointments table
            db.exec(`
                CREATE TABLE IF NOT EXISTS citas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    tecnico TEXT NOT NULL,
                    fecha_hora DATETIME NOT NULL,
                    duracion INTEGER DEFAULT 60,
                    estado TEXT DEFAULT 'programada',
                    notas TEXT,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
                )
            `);
            console.log('✓ Tabla de citas creada/verificada');


            // Create default admin user
            const adminPassword = bcrypt.hashSync('admin123', 10);
            const insertAdmin = db.prepare(`
                INSERT OR IGNORE INTO usuarios (username, password_hash, nombre_completo, email, rol)
                VALUES (?, ?, ?, ?, ?)
            `);
            insertAdmin.run('admin', adminPassword, 'Administrador', 'admin@local', 'admin');

            console.log('✓ Base de datos inicializada correctamente');
            console.log('✓ Usuario admin creado (admin/admin123)');

            resolve();
        } catch (err) {
            console.error('Error initializing database:', err);
            reject(err);
        }
    });
};

// Get user by username
const getUserByUsername = (username) => {
    const stmt = db.prepare('SELECT * FROM usuarios WHERE username = ? AND activo = 1');
    return stmt.get(username);
};

// Create new user
const createUser = (username, passwordHash, nombreCompleto, email, rol) => {
    const stmt = db.prepare(`
        INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, passwordHash, nombreCompleto, email, rol);
    return result.lastInsertRowid;
};

// Get all users
const getAllUsers = () => {
    const stmt = db.prepare('SELECT id, username, nombre_completo, email, rol, activo, fecha_creacion FROM usuarios');
    return stmt.all();
};

// Update user
const updateUser = (id, updates) => {
    const fields = [];
    const values = [];

    if (updates.nombre_completo !== undefined) {
        fields.push('nombre_completo = ?');
        values.push(updates.nombre_completo);
    }
    if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email);
    }
    if (updates.rol !== undefined) {
        fields.push('rol = ?');
        values.push(updates.rol);
    }
    if (updates.password_hash !== undefined) {
        fields.push('password_hash = ?');
        values.push(updates.password_hash);
    }
    if (updates.activo !== undefined) {
        fields.push('activo = ?');
        values.push(updates.activo);
    }

    values.push(id);

    const stmt = db.prepare(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
};

// Delete user
const deleteUser = (id) => {
    const stmt = db.prepare('DELETE FROM usuarios WHERE id = ?');
    return stmt.run(id);
};

// Update last access
const updateLastAccess = (username) => {
    const stmt = db.prepare('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE username = ?');
    stmt.run(username);
};

// Ticket functions
const createTicket = (ticketData) => {
    // Generar un ticket_id si no existe
    const ticketId = ticketData.ticket_id || `TICK-${Date.now()}`;

    const stmt = db.prepare(`
        INSERT INTO tickets (ticket_id, nombre, email, telefono, servicio, prioridad, descripcion, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        ticketId,
        ticketData.nombre,
        ticketData.email,
        ticketData.telefono,
        ticketData.servicio,
        ticketData.prioridad,
        ticketData.descripcion,
        ticketData.estado || 'pendiente'
    );
    return { ticketId, id: result.lastInsertRowid };
};

const getAllTickets = (includeArchived = false) => {
    const query = includeArchived
        ? 'SELECT * FROM tickets ORDER BY fecha_creacion DESC'
        : 'SELECT * FROM tickets WHERE archivado = 0 ORDER BY fecha_creacion DESC';
    const stmt = db.prepare(query);
    return stmt.all();
};

const getTicketById = (ticketId) => {
    const stmt = db.prepare('SELECT * FROM tickets WHERE ticket_id = ?');
    return stmt.get(ticketId);
};

const updateTicket = (ticketId, updates) => {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    fields.push('fecha_actualizacion = CURRENT_TIMESTAMP');
    values.push(ticketId);

    const stmt = db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE ticket_id = ?`);
    return stmt.run(...values);
};

const deleteTicket = (ticketId) => {
    const stmt = db.prepare('DELETE FROM tickets WHERE ticket_id = ?');
    return stmt.run(ticketId);
};

const archiveTicket = (ticketId, username) => {
    const stmt = db.prepare(`
        UPDATE tickets 
        SET archivado = 1, fecha_archivado = CURRENT_TIMESTAMP
        WHERE ticket_id = ?
    `);
    return stmt.run(ticketId);
};

// Service functions
const getAllServices = (includeArchived = false) => {
    const query = includeArchived
        ? 'SELECT * FROM servicios ORDER BY nombre'
        : 'SELECT * FROM servicios WHERE archivado = 0 ORDER BY nombre';
    const stmt = db.prepare(query);
    return stmt.all();
};

const createService = (codigo, nombre, descripcion) => {
    const stmt = db.prepare(`
        INSERT INTO servicios (codigo, nombre, descripcion, activo)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
        codigo,
        nombre,
        descripcion || '',
        1
    );
    return { id: result.lastInsertRowid };
};

const updateService = (id, codigo, nombre, descripcion, activo) => {
    const stmt = db.prepare(`
        UPDATE servicios 
        SET codigo = ?, nombre = ?, descripcion = ?, activo = ?
        WHERE id = ?
    `);
    const result = stmt.run(codigo, nombre, descripcion || '', activo !== undefined ? activo : 1, id);
    return { changes: result.changes };
};

const deleteService = (id) => {
    const stmt = db.prepare('DELETE FROM servicios WHERE id = ?');
    return stmt.run(id);
};

const addNoteToTicket = (ticketId, nota, autor) => {
    const stmt = db.prepare(`
        INSERT INTO notas (ticket_id, nota, autor)
        VALUES (?, ?, ?)
    `);
    const result = stmt.run(ticketId, nota, autor);
    return { id: result.lastInsertRowid };
};

const getTicketNotes = (ticketId) => {
    const stmt = db.prepare('SELECT * FROM notas WHERE ticket_id = ? AND archivado = 0 ORDER BY fecha_creacion DESC');
    return stmt.all(ticketId);
};

// WhatsApp functions
const registerWhatsAppContact = (ticketId, telefono, mensaje, enviado_por) => {
    const stmt = db.prepare(`
        INSERT INTO whatsapp_contactos (ticket_id, telefono, mensaje, enviado_por)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(ticketId, telefono, mensaje, enviado_por);
    return { id: result.lastInsertRowid };
};

const getWhatsAppContacts = (ticketId) => {
    const stmt = db.prepare('SELECT * FROM whatsapp_contactos WHERE ticket_id = ? ORDER BY fecha_contacto DESC');
    return stmt.all(ticketId);
};

// Empresas functions
const getAllEmpresas = () => {
    const stmt = db.prepare('SELECT * FROM empresas WHERE activo = 1 ORDER BY nombre');
    return stmt.all();
};

const getEmpresaById = (id) => {
    const stmt = db.prepare('SELECT * FROM empresas WHERE id = ?');
    return stmt.get(id);
};

const createEmpresa = (nombre, cif, direccion, telefono, email, verifactu) => {
    const stmt = db.prepare(`
        INSERT INTO empresas (nombre, cif, direccion, telefono, email, verifactu)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(nombre, cif, direccion, telefono, email, verifactu);
    return { id: result.lastInsertRowid };
};

const updateEmpresa = (id, nombre, cif, direccion, telefono, email, activo, verifactu) => {
    const stmt = db.prepare(`
        UPDATE empresas 
        SET nombre = ?, cif = ?, direccion = ?, telefono = ?, email = ?, activo = ?, verifactu = ?
        WHERE id = ?
    `);
    const result = stmt.run(nombre, cif, direccion, telefono, email, activo, verifactu, id);
    return { changes: result.changes };
};

const deleteEmpresa = (id) => {
    const stmt = db.prepare('DELETE FROM empresas WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

// Materiales functions
const getAllMaterials = () => {
    const stmt = db.prepare('SELECT * FROM materiales WHERE activo = 1 ORDER BY nombre');
    return stmt.all();
};

const getMaterialById = (id) => {
    const stmt = db.prepare('SELECT * FROM materiales WHERE id = ?');
    return stmt.get(id);
};

const createMaterial = (nombre, descripcion, precio) => {
    const stmt = db.prepare(`
        INSERT INTO materiales (nombre, descripcion, precio)
        VALUES (?, ?, ?)
    `);
    const result = stmt.run(nombre, descripcion, precio);
    return { id: result.lastInsertRowid };
};

const updateMaterial = (id, nombre, descripcion, precio) => {
    const stmt = db.prepare(`
        UPDATE materiales 
        SET nombre = ?, descripcion = ?, precio = ?
        WHERE id = ?
    `);
    const result = stmt.run(nombre, descripcion, precio, id);
    return { changes: result.changes };
};

const deleteMaterial = (id) => {
    const stmt = db.prepare('DELETE FROM materiales WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

const addMaterialToTicket = (ticketId, materialId, cantidad) => {
    // Placeholder - would need a junction table
    return { success: true };
};

const getMaterialsForTicket = (ticketId) => {
    // Placeholder - would need a junction table
    return [];
};

const removeMaterialFromTicket = (ticketId, materialId) => {
    // Placeholder - would need a junction table
    return { changes: 1 };
};

// Facturas functions
const getAllInvoices = () => {
    const stmt = db.prepare('SELECT * FROM facturas ORDER BY fecha_emision DESC');
    return stmt.all();
};

const getInvoiceById = (id) => {
    const stmt = db.prepare('SELECT * FROM facturas WHERE id = ?');
    return stmt.get(id);
};

const getInvoicesByTicketId = (ticketId) => {
    const stmt = db.prepare('SELECT * FROM facturas WHERE ticket_id = ?');
    return stmt.all(ticketId);
};

const createInvoice = (ticketId, empresaId, numeroFactura, total) => {
    const stmt = db.prepare(`
        INSERT INTO facturas (ticket_id, empresa_id, numero_factura, total)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(ticketId, empresaId, numeroFactura, total);
    return { id: result.lastInsertRowid };
};

const updateInvoice = (id, updates) => {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    values.push(id);

    const stmt = db.prepare(`UPDATE facturas SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return { changes: result.changes };
};

const presentarInvoice = (id) => {
    const stmt = db.prepare(`
        UPDATE facturas 
        SET presentada = 1, fecha_presentacion = CURRENT_TIMESTAMP, estado = 'presentada'
        WHERE id = ?
    `);
    const result = stmt.run(id);
    return { changes: result.changes };
};

const deleteInvoice = (id) => {
    const stmt = db.prepare('DELETE FROM facturas WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

// Horas de trabajo functions
const addHorasTrabajo = (ticketId, tecnico, horas, descripcion) => {
    const stmt = db.prepare(`
        INSERT INTO horas_trabajo (ticket_id, tecnico, horas, descripcion)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(ticketId, tecnico, horas, descripcion);
    return { id: result.lastInsertRowid };
};

const getHorasTrabajo = (ticketId) => {
    const stmt = db.prepare('SELECT * FROM horas_trabajo WHERE ticket_id = ? ORDER BY fecha DESC');
    return stmt.all(ticketId);
};

const getTotalHorasTicket = (ticketId) => {
    const stmt = db.prepare('SELECT SUM(horas) as total FROM horas_trabajo WHERE ticket_id = ?');
    const result = stmt.get(ticketId);
    return result?.total || 0;
};

const getHorasPorTecnico = (tecnico) => {
    const stmt = db.prepare('SELECT * FROM horas_trabajo WHERE tecnico = ? ORDER BY fecha DESC');
    return stmt.all(tecnico);
};

const updateHorasTrabajo = (id, horas, descripcion) => {
    const stmt = db.prepare(`
        UPDATE horas_trabajo 
        SET horas = ?, descripcion = ?
        WHERE id = ?
    `);
    const result = stmt.run(horas, descripcion, id);
    return { changes: result.changes };
};

const deleteHorasTrabajo = (id) => {
    const stmt = db.prepare('DELETE FROM horas_trabajo WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

// Citas functions
const createAppointment = (data) => {
    const { ticket_id, tecnico_id, fecha_cita, descripcion } = data;
    const stmt = db.prepare(`
        INSERT INTO citas (ticket_id, tecnico_id, fecha_cita, descripcion)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(ticket_id, tecnico_id, fecha_cita, descripcion || '');
    return { id: result.lastInsertRowid };
};

const getAppointmentsByTicket = (ticketId) => {
    const stmt = db.prepare('SELECT * FROM citas WHERE ticket_id = ? ORDER BY fecha_hora');
    return stmt.all(ticketId);
};

const getAppointmentsByTechnician = (tecnico) => {
    const stmt = db.prepare('SELECT * FROM citas WHERE tecnico = ? ORDER BY fecha_hora');
    return stmt.all(tecnico);
};

const getAllAppointments = () => {
    const stmt = db.prepare('SELECT * FROM citas ORDER BY fecha_hora');
    return stmt.all();
};

const updateAppointmentStatus = (id, estado) => {
    const stmt = db.prepare('UPDATE citas SET estado = ? WHERE id = ?');
    const result = stmt.run(estado, id);
    return { changes: result.changes };
};

const deleteAppointment = (id) => {
    const stmt = db.prepare('DELETE FROM citas WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

const transferirTicketEmpresa = (ticketId, empresaId) => {
    // Placeholder function
    return { success: true };
};

// ==================== FACTURACIÓN MULTI-TICKET ====================

const createMultiTicketInvoice = (invoiceData) => {
    return new Promise((resolve, reject) => {
        const invoiceId = generateInvoiceId();
        const { ticket_ids, cliente_nombre, cliente_email, fecha_vencimiento, subtotal, iva, total, items, empresa_id } = invoiceData;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const invoiceSql = `
                INSERT INTO facturas (factura_id, ticket_id, cliente_nombre, cliente_email, fecha_vencimiento, subtotal, iva, total, empresa_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(invoiceSql, [invoiceId, ticket_ids[0], cliente_nombre, cliente_email, fecha_vencimiento, subtotal, iva, total, empresa_id || null], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }

                // Insert factura_items
                const itemSql = `
                    INSERT INTO factura_items (factura_id, concepto, descripcion, cantidad, precio_unitario, total)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                const stmt = db.prepare(itemSql);
                for (const item of items) {
                    stmt.run(invoiceId, item.concepto, item.descripcion, item.cantidad, item.precio_unitario, item.total);
                }
                stmt.finalize((err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    // Insert factura_tickets (relación)
                    const relSql = `INSERT INTO factura_tickets (factura_id, ticket_id) VALUES (?, ?)`;
                    const relStmt = db.prepare(relSql);
                    for (const ticketId of ticket_ids) {
                        relStmt.run(invoiceId, ticketId);
                    }
                    relStmt.finalize((err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        db.run('COMMIT');
                        resolve({ id: this.lastID, invoiceId, ticketCount: ticket_ids.length });
                    });
                });
            });
        });
    });
};

const getTicketsForInvoice = (ticketIds) => {
    return new Promise((resolve, reject) => {
        if (!ticketIds || ticketIds.length === 0) return resolve([]);

        const placeholders = ticketIds.map(() => '?').join(',');
        const sql = `
            SELECT t.*, 
                   COALESCE(SUM(h.horas), 0) as total_horas,
                   COALESCE(SUM(m.subtotal), 0) as total_materiales
            FROM tickets t
            LEFT JOIN horas_trabajo h ON t.ticket_id = h.ticket_id
            LEFT JOIN ticket_materiales m ON t.ticket_id = m.ticket_id
            WHERE t.ticket_id IN (${placeholders})
            GROUP BY t.ticket_id
        `;
        db.all(sql, ticketIds, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

module.exports = {
    initDatabase,
    // Users
    getUserByUsername,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    updateLastAccess,
    updateUserLastAccess: updateLastAccess,
    // Tickets
    createTicket,
    getAllTickets,
    getTicketById,
    getArchivedTickets,
    updateTicket,
    deleteTicket,
    archiveTicket,
    // Notas
    addNoteToTicket,
    getTicketNotes,
    // WhatsApp
    registerWhatsAppContact,
    getWhatsAppContacts,
    // Servicios
    getAllServices,
    createService,
    updateService,
    deleteService,
    // Empresas
    getAllEmpresas,
    getEmpresaById,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    transferirTicketEmpresa,
    // Materiales
    getAllMaterials,
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    addMaterialToTicket,
    getMaterialsForTicket,
    removeMaterialFromTicket,
    // Facturas
    getAllInvoices,
    getInvoiceById,
    getInvoicesByTicketId,
    createInvoice,
    updateInvoice,
    presentarInvoice,
    deleteInvoice,
    createMultiTicketInvoice,
    getTicketsForInvoice,
    // Horas de trabajo
    addHorasTrabajo,
    getHorasTrabajo,
    getTotalHorasTicket,
    getHorasPorTecnico,
    updateHorasTrabajo,
    deleteHorasTrabajo,
    // Citas
    createAppointment,
    getAppointmentsByTicket,
    getAppointmentsByTechnician,
    getAllAppointments,
    updateAppointmentStatus,
    deleteAppointment,
    db

};
