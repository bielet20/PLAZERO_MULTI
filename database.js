const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Usar base de datos persistente
const db = new Database('database.sqlite');

console.log('✅ Usando base de datos PERSISTENTE (tickets.db)');

// Initialize database
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        try {
            // Habilitar claves foráneas y modo WAL para mejor concurrencia
            db.exec('PRAGMA foreign_keys = ON;');
            db.exec('PRAGMA journal_mode = WAL;');

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
                    tecnico_asignado TEXT,
                    empresa_id INTEGER,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    archivado INTEGER DEFAULT 0,
                    fecha_archivado DATETIME,
                    usuario_archivado TEXT,
                    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
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
                    whatsapp TEXT,
                    rol TEXT DEFAULT 'tecnico',
                    activo INTEGER DEFAULT 1,
                    ultimo_acceso DATETIME,
                    reset_token TEXT,
                    reset_token_expires DATETIME,
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

            // Create clientes table
            db.exec(`
                CREATE TABLE IF NOT EXISTS clientes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    email TEXT,
                    telefono TEXT,
                    direccion TEXT,
                    cif TEXT,
                    empresa_id INTEGER,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
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
                    factura_id TEXT UNIQUE,
                    ticket_id TEXT,
                    empresa_id INTEGER,
                    cliente_nombre TEXT,
                    cliente_email TEXT,
                    fecha_vencimiento DATETIME,
                    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
                    subtotal REAL DEFAULT 0,
                    iva REAL DEFAULT 0,
                    total REAL DEFAULT 0,
                    estado TEXT DEFAULT 'borrador',
                    presentada INTEGER DEFAULT 0,
                    bloqueada INTEGER DEFAULT 0,
                    fecha_presentacion DATETIME,
                    hash TEXT,
                    hash_anterior TEXT,
                    cliente_telefono TEXT,
                    cliente_direccion TEXT,
                    cliente_cif TEXT,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
                )
            `);

            // Migrate facturas table if columns missing
            const facturasInfo = db.prepare('PRAGMA table_info(facturas)').all();
            const hasTelefono = facturasInfo.some(c => c.name === 'cliente_telefono');
            if (!hasTelefono) {
                db.exec('ALTER TABLE facturas ADD COLUMN cliente_telefono TEXT');
                db.exec('ALTER TABLE facturas ADD COLUMN cliente_direccion TEXT');
                db.exec('ALTER TABLE facturas ADD COLUMN cliente_cif TEXT');
            }

            // Create factura_items table
            db.exec(`
                CREATE TABLE IF NOT EXISTS factura_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    factura_id TEXT NOT NULL,
                    concepto TEXT NOT NULL,
                    descripcion TEXT,
                    cantidad REAL NOT NULL,
                    precio_unitario REAL NOT NULL,
                    total REAL NOT NULL,
                    FOREIGN KEY (factura_id) REFERENCES facturas(factura_id)
                )
            `);

            // Create ticket_materiales table
            db.exec(`
                CREATE TABLE IF NOT EXISTS ticket_materiales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    material_id INTEGER NOT NULL,
                    cantidad REAL NOT NULL,
                    precio_unitario REAL NOT NULL,
                    registrado_por TEXT,
                    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY (material_id) REFERENCES materiales(id)
                )
            `);

            // Create horas_trabajo table
            db.exec(`
                CREATE TABLE IF NOT EXISTS horas_trabajo (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    tecnico TEXT,
                    tecnico_id INTEGER,
                    horas REAL NOT NULL,
                    descripcion TEXT,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
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
                    tecnico_id INTEGER NOT NULL,
                    fecha_cita DATETIME NOT NULL,
                    duracion INTEGER DEFAULT 60,
                    estado TEXT DEFAULT 'programada',
                    descripcion TEXT,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
                )
            `);
            console.log('✓ Tabla de citas creada/verificada');


            // Create default admin user
            const adminPassword = bcrypt.hashSync('Admin123!@#$', 10);
            const rootPassword = bcrypt.hashSync('Root_2026', 10);

            const insertUser = db.prepare(`
                INSERT OR IGNORE INTO usuarios (username, password_hash, nombre_completo, email, rol)
                VALUES (?, ?, ?, ?, ?)
            `);

            insertUser.run('admin', adminPassword, 'Administrador', 'admin@local', 'admin');
            insertUser.run('root', rootPassword, 'Superusuario', 'root@local', 'admin');

            console.log('✓ Usuarios predeterminados creados (admin y root)');

            // Insert default services if table is empty
            const serviceCount = db.prepare('SELECT COUNT(*) as count FROM servicios').get().count;
            if (serviceCount === 0) {
                const insertService = db.prepare('INSERT INTO servicios (codigo, nombre, descripcion) VALUES (?, ?, ?)');
                const services = [
                    ['construccion', 'Construcción', 'Servicios integrales de construcción y edificación'],
                    ['reparacion', 'Reparación', 'Mantenimiento y reparación de instalaciones'],
                    ['obras', 'Obras', 'Reformas y adecuación de espacios'],
                    ['fugas', 'Búsqueda de Fugas', 'Detección y reparación de fugas de agua y gas']
                ];
                services.forEach(service => {
                    insertService.run(...service);
                });
                console.log('✓ Servicios predeterminados insertados');
            }

            console.log('✓ Base de datos inicializada correctamente');
            console.log('✓ Usuario admin creado (admin/Admin123!@#$)');

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
const createUser = (username, passwordHash, nombreCompleto, email, whatsapp, rol) => {
    const stmt = db.prepare(`
        INSERT INTO usuarios (username, password_hash, nombre_completo, email, whatsapp, rol)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, passwordHash, nombreCompleto, email, whatsapp, rol);
    return result.lastInsertRowid;
};

// Get all users
const getAllUsers = () => {
    const stmt = db.prepare('SELECT id, username, nombre_completo, email, whatsapp, rol, activo, fecha_creacion FROM usuarios');
    return stmt.all();
};

const getDraftInvoicesByEmpresa = (empresaId) => {
    const stmt = db.prepare(`
        SELECT * FROM facturas 
        WHERE empresa_id = ? AND bloqueada = 0 AND presentada = 0
        ORDER BY fecha_emision DESC
    `);
    return stmt.all(empresaId);
};

const appendItemsToInvoice = (invoiceId, items, ticketId = null) => {
    const appendTx = db.transaction(() => {
        // 1. Get current invoice
        const invoice = db.prepare('SELECT subtotal, total FROM facturas WHERE factura_id = ?').get(invoiceId);
        if (!invoice) throw new Error('Factura no encontrada');

        // 2. Insert new items
        const itemStmt = db.prepare(`
            INSERT INTO factura_items (factura_id, concepto, descripcion, cantidad, precio_unitario, total)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        let newSubtotal = invoice.subtotal;
        for (const item of items) {
            const itemTotal = item.cantidad * item.precio_unitario;
            itemStmt.run(invoiceId, item.concepto, item.descripcion || '', item.cantidad, item.precio_unitario, itemTotal);
            newSubtotal += itemTotal;
        }

        // 3. Update invoice totals
        const newIva = newSubtotal * 0.21;
        const newTotal = newSubtotal + newIva;

        const updateStmt = db.prepare(`
            UPDATE facturas 
            SET subtotal = ?, iva = ?, total = ?
            WHERE factura_id = ?
        `);
        updateStmt.run(newSubtotal, newIva, newTotal, invoiceId);

        // 4. Update ticket_id if it was null (optional, usually invoices created from tickets already have it)
        // Note: multiple tickets can contribute to one invoice now, so we might want to store ticket_id list 
        // but current schema only has one ticket_id. We'll leave it or maybe use the first one.

        return { success: true, invoiceId };
    });

    return appendTx();
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
    if (updates.whatsapp !== undefined) {
        fields.push('whatsapp = ?');
        values.push(updates.whatsapp);
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

const getArchivedTickets = () => {
    const stmt = db.prepare('SELECT * FROM tickets WHERE archivado = 1 ORDER BY fecha_archivado DESC');
    return stmt.all();
};

const getTicketById = (ticketId) => {
    if (!ticketId) return null;
    const trimmedId = ticketId.toString().trim();

    const stmt = db.prepare('SELECT * FROM tickets WHERE ticket_id = ?');
    return stmt.get(trimmedId);
};

const updateTicketStatus = (ticketId, estado) => {
    if (!ticketId) return { changes: 0 };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        UPDATE tickets 
        SET estado = ?, fecha_actualizacion = CURRENT_TIMESTAMP 
        WHERE ticket_id = ?
    `);
    const result = stmt.run(estado, trimmedId);
    return { changes: result.changes };
};

const updateTicket = (ticketId, updates) => {
    if (!ticketId) return { changes: 0 };
    const trimmedId = ticketId.toString().trim();
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    fields.push('fecha_actualizacion = CURRENT_TIMESTAMP');
    values.push(trimmedId);

    const stmt = db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE ticket_id = ?`);
    const result = stmt.run(...values);
    return { changes: result.changes };
};

const archiveTicket = (ticketId, username) => {
    if (!ticketId) return { changes: 0 };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        UPDATE tickets 
        SET archivado = 1, fecha_archivado = CURRENT_TIMESTAMP, usuario_archivado = ?
        WHERE ticket_id = ?
    `);
    const result = stmt.run(username, trimmedId);
    return { changes: result.changes };
};

const restoreTicket = (ticketId) => {
    if (!ticketId) return { changes: 0 };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        UPDATE tickets 
        SET archivado = 0, fecha_archivado = NULL, usuario_archivado = NULL
        WHERE ticket_id = ?
    `);
    const result = stmt.run(trimmedId);
    return { changes: result.changes };
};

const deleteTicket = (ticketId) => {
    if (!ticketId) return { changes: 0 };
    const trimmedId = ticketId.toString().trim();
    const deleteTx = db.transaction((id) => {
        db.prepare('DELETE FROM notas WHERE ticket_id = ?').run(id);
        db.prepare('DELETE FROM whatsapp_contactos WHERE ticket_id = ?').run(id);
        return db.prepare('DELETE FROM tickets WHERE ticket_id = ?').run(id);
    });
    const result = deleteTx(trimmedId);
    return { changes: result.changes };
};

const getTicketsByStatus = (estado) => {
    const stmt = db.prepare('SELECT * FROM tickets WHERE estado = ? AND archivado = 0 ORDER BY fecha_creacion DESC');
    return stmt.all(estado);
};

const assignTechnician = (ticketId, tecnico) => {
    if (!ticketId) return { changes: 0 };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare('UPDATE tickets SET tecnico_asignado = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE ticket_id = ?');
    const result = stmt.run(tecnico, trimmedId);
    return { changes: result.changes };
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
    if (!ticketId) return { id: null };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        INSERT INTO notas (ticket_id, nota, autor)
        VALUES (?, ?, ?)
    `);
    const result = stmt.run(trimmedId, nota, autor);
    return { id: result.lastInsertRowid };
};

const archiveNote = (noteId, usuario) => {
    const stmt = db.prepare(`
        UPDATE notas 
        SET archivado = 1, fecha_archivado = CURRENT_TIMESTAMP, usuario_archivado = ?
        WHERE id = ?
    `);
    const result = stmt.run(usuario, noteId);
    return { changes: result.changes };
};

const restoreNote = (noteId) => {
    const stmt = db.prepare(`
        UPDATE notas 
        SET archivado = 0, fecha_archivado = NULL, usuario_archivado = NULL
        WHERE id = ?
    `);
    const result = stmt.run(noteId);
    return { changes: result.changes };
};

const deleteNote = (noteId) => {
    const stmt = db.prepare('DELETE FROM notas WHERE id = ?');
    const result = stmt.run(noteId);
    return { changes: result.changes };
};

const getTicketNotes = (ticketId) => {
    if (!ticketId) return [];
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare('SELECT * FROM notas WHERE ticket_id = ? AND archivado = 0 ORDER BY fecha_creacion DESC');
    return stmt.all(trimmedId);
};

// WhatsApp functions
const registerWhatsAppContact = (ticketId, telefono, mensaje, enviado_por) => {
    if (!ticketId) return { id: null };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        INSERT INTO whatsapp_contactos (ticket_id, telefono, mensaje, enviado_por)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(trimmedId, telefono, mensaje, enviado_por);
    return { id: result.lastInsertRowid };
};

const getWhatsAppContacts = (ticketId) => {
    if (!ticketId) return [];
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare('SELECT * FROM whatsapp_contactos WHERE ticket_id = ? ORDER BY fecha_contacto DESC');
    return stmt.all(trimmedId);
};

// Clientes functions
const getAllClientes = () => {
    const stmt = db.prepare('SELECT * FROM clientes ORDER BY nombre');
    return stmt.all();
};

const getClienteById = (id) => {
    const stmt = db.prepare('SELECT * FROM clientes WHERE id = ?');
    return stmt.get(id);
};

const createCliente = (clienteData) => {
    const { nombre, email, telefono, direccion, cif, empresa_id } = clienteData;
    const stmt = db.prepare(`
        INSERT INTO clientes (nombre, email, telefono, direccion, cif, empresa_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(nombre, email || '', telefono || '', direccion || '', cif || '', empresa_id || null);
    return { id: result.lastInsertRowid };
};

const updateCliente = (id, updates) => {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(updates[key]);
        }
    });

    if (fields.length === 0) return { changes: 0 };

    values.push(id);
    const stmt = db.prepare(`UPDATE clientes SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return { changes: result.changes };
};

const deleteCliente = (id) => {
    const stmt = db.prepare('DELETE FROM clientes WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
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
    const result = stmt.run(nombre, descripcion || '', precio);
    return { id: result.lastInsertRowid };
};

const updateMaterial = (id, nombre, descripcion, precio, activo) => {
    const stmt = db.prepare(`
        UPDATE materiales 
        SET nombre = ?, descripcion = ?, precio = ?, activo = ?
        WHERE id = ?
    `);
    const result = stmt.run(nombre, descripcion || '', precio, activo !== undefined ? activo : 1, id);
    return { changes: result.changes };
};

const deleteMaterial = (id) => {
    // Verificar si está en uso
    const usage = db.prepare('SELECT COUNT(*) as count FROM ticket_materiales WHERE material_id = ?').get(id);
    if (usage.count > 0) {
        throw new Error('El material está en uso y no puede ser eliminado. Desactívelo en su lugar.');
    }
    const stmt = db.prepare('DELETE FROM materiales WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

const addMaterialToTicket = (ticketId, materialId, cantidad, precioUnitario, registradoPor) => {
    if (!ticketId) return { id: null };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        INSERT INTO ticket_materiales (ticket_id, material_id, cantidad, precio_unitario, registrado_por)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(trimmedId, materialId, cantidad, precioUnitario, registradoPor);
    return { id: result.lastInsertRowid };
};

const getMaterialsForTicket = (ticketId) => {
    if (!ticketId) return [];
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        SELECT tm.*, m.nombre 
        FROM ticket_materiales tm
        JOIN materiales m ON tm.material_id = m.id
        WHERE tm.ticket_id = ?
        ORDER BY tm.fecha_registro DESC
    `);
    return stmt.all(trimmedId);
};

const removeMaterialFromTicket = (id) => {
    const stmt = db.prepare('DELETE FROM ticket_materiales WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

// Facturas functions
const generateInvoiceId = () => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString(36).toUpperCase();
    return `FAC-${year}-${timestamp}`;
};

const getAllInvoices = () => {
    const stmt = db.prepare('SELECT * FROM facturas ORDER BY fecha_emision DESC');
    return stmt.all();
};

const getInvoiceById = (id) => {
    // Check if it's a numeric ID or a factura_id string
    const query = isNaN(id) ?
        'SELECT f.*, e.cif as emisor_cif FROM facturas f LEFT JOIN empresas e ON f.empresa_id = e.id WHERE f.factura_id = ?' :
        'SELECT f.*, e.cif as emisor_cif FROM facturas f LEFT JOIN empresas e ON f.empresa_id = e.id WHERE f.id = ?';
    const stmt = db.prepare(query);
    const invoice = stmt.get(id);
    if (invoice) {
        invoice.items = db.prepare('SELECT * FROM factura_items WHERE factura_id = ?').all(invoice.factura_id);
    }
    return invoice;
};

const getInvoicesByTicketId = (ticketId) => {
    if (!ticketId) return [];
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare('SELECT * FROM facturas WHERE ticket_id = ?');
    return stmt.all(trimmedId);
};

const createInvoice = (invoiceData) => {
    const crypto = require('crypto');
    let { ticket_id, empresa_id, cliente_nombre, cliente_email, cliente_telefono, cliente_direccion, cliente_cif, fecha_vencimiento, subtotal, iva, total, items } = invoiceData;

    const invoiceId = generateInvoiceId();

    // Calculate totals if missing
    if (subtotal === undefined || total === undefined) {
        subtotal = 0;
        items.forEach(item => {
            item.total = item.cantidad * item.precio_unitario;
            subtotal += item.total;
        });
        iva = subtotal * 0.21;
        total = subtotal + iva;
    }

    // Get the last invoice's hash for chaining
    const lastInvoice = db.prepare('SELECT hash FROM facturas ORDER BY id DESC LIMIT 1').get();
    const hashAnterior = lastInvoice ? lastInvoice.hash : '';

    // Check if Empresa has VeriFactu enabled and get CIF
    const empresa = db.prepare('SELECT cif, verifactu FROM empresas WHERE id = ?').get(empresa_id);
    const isVeriFactuEnabled = empresa ? (empresa.verifactu === 1) : false;
    const empresaCIF = empresa ? empresa.cif : '';

    const createTx = db.transaction(() => {
        let hash = null;
        let hAnterior = null;

        if (isVeriFactuEnabled) {
            // Include CIF in hashing as per traceability requirements
            const dataToHash = `${empresaCIF}|${invoiceId}|${total}|${new Date().toISOString()}|${hashAnterior}`;
            hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
            hAnterior = hashAnterior;
        }

        const ticket_id_trimmed = ticket_id.toString().trim();
        const invoiceStmt = db.prepare(`
            INSERT INTO facturas (factura_id, ticket_id, empresa_id, cliente_nombre, cliente_email, cliente_telefono, cliente_direccion, cliente_cif, fecha_vencimiento, subtotal, iva, total, hash, hash_anterior)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        invoiceStmt.run(invoiceId, ticket_id_trimmed, empresa_id || null, cliente_nombre, cliente_email, cliente_telefono || null, cliente_direccion || null, cliente_cif || null, fecha_vencimiento, subtotal, iva, total, hash, hAnterior);

        const itemStmt = db.prepare(`
            INSERT INTO factura_items (factura_id, concepto, descripcion, cantidad, precio_unitario, total)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
            itemStmt.run(invoiceId, item.concepto, item.descripcion || '', item.cantidad, item.precio_unitario, item.total);
        }

        return { invoiceId };
    });

    return createTx();
};

const updateInvoice = (id, updates) => {
    const crypto = require('crypto');

    // Check if locked
    const current = getInvoiceById(id);
    if (!current) throw new Error('Factura no encontrada');
    if (current.bloqueada === 1) throw new Error('La factura está bloqueada y no se puede modificar');

    const { cliente_nombre, cliente_email, cliente_telefono, cliente_direccion, cliente_cif, fecha_vencimiento, items, estado } = updates;

    const updateTx = db.transaction(() => {
        // Update fields if provided
        const fields = [];
        const values = [];

        if (cliente_nombre !== undefined) { fields.push('cliente_nombre = ?'); values.push(cliente_nombre); }
        if (cliente_email !== undefined) { fields.push('cliente_email = ?'); values.push(cliente_email); }
        if (cliente_telefono !== undefined) { fields.push('cliente_telefono = ?'); values.push(cliente_telefono); }
        if (cliente_direccion !== undefined) { fields.push('cliente_direccion = ?'); values.push(cliente_direccion); }
        if (cliente_cif !== undefined) { fields.push('cliente_cif = ?'); values.push(cliente_cif); }
        if (fecha_vencimiento !== undefined) { fields.push('fecha_vencimiento = ?'); values.push(fecha_vencimiento); }
        if (estado !== undefined) { fields.push('estado = ?'); values.push(estado); }

        // Handle items and totals
        if (items && items.length > 0) {
            // Delete old items
            db.prepare('DELETE FROM factura_items WHERE factura_id = ?').run(current.factura_id);

            let subtotal = 0;
            const itemStmt = db.prepare(`
                INSERT INTO factura_items (factura_id, concepto, descripcion, cantidad, precio_unitario, total)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const item of items) {
                const totalAction = item.cantidad * item.precio_unitario;
                itemStmt.run(current.factura_id, item.concepto, item.descripcion || '', item.cantidad, item.precio_unitario, totalAction);
                subtotal += totalAction;
            }

            const iva = subtotal * 0.21; // Standard IVA 21%
            const total = subtotal + iva;

            fields.push('subtotal = ?', 'iva = ?', 'total = ?');
            values.push(subtotal, iva, total);

            // Recalculate hash if VeriFactu was enabled
            if (current.hash) {
                // Ensure emisor_cif is known (using current.emisor_cif from getInvoiceById join)
                const emisorCif = current.emisor_cif || '';
                const dataToHash = `${emisorCif}|${current.factura_id}|${total}|${current.fecha_emision}|${current.hash_anterior || ''}`;
                const newHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
                fields.push('hash = ?');
                values.push(newHash);
            }
        }

        if (fields.length > 0) {
            values.push(id);
            const stmt = db.prepare(`UPDATE facturas SET ${fields.join(', ')} WHERE id = ?`);
            stmt.run(...values);
        }

        return { success: true };
    });

    return updateTx();
};

const presentarInvoice = (id) => {
    const query = isNaN(id) ? `
        UPDATE facturas 
        SET presentada = 1, bloqueada = 1, fecha_presentacion = CURRENT_TIMESTAMP, estado = 'presentada'
        WHERE factura_id = ?
    ` : `
        UPDATE facturas 
        SET presentada = 1, bloqueada = 1, fecha_presentacion = CURRENT_TIMESTAMP, estado = 'presentada'
        WHERE id = ?
    `;
    const stmt = db.prepare(query);
    const result = stmt.run(id);
    return { changes: result.changes };
};

const deleteInvoice = (id) => {
    const current = getInvoiceById(id);
    if (current && current.bloqueada === 1) throw new Error('No se puede eliminar una factura presentada/bloqueada');

    // Explicitly delete items first (due to FK)
    if (current) {
        db.prepare('DELETE FROM factura_items WHERE factura_id = ?').run(current.factura_id);
    }

    const stmt = db.prepare('DELETE FROM facturas WHERE id = ?');
    const result = stmt.run(id);
    return { changes: result.changes };
};

// Horas de trabajo functions
const addHorasTrabajo = (ticketId, tecnico, horas, descripcion, tecnico_id) => {
    if (!ticketId) return { id: null };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        INSERT INTO horas_trabajo (ticket_id, tecnico, horas, descripcion, tecnico_id)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(trimmedId, tecnico, horas, descripcion, tecnico_id || null);
    return { id: result.lastInsertRowid };
};

const getHorasTrabajo = (ticketId) => {
    if (!ticketId) return [];
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare('SELECT id, ticket_id, tecnico as tecnico_nombre, horas, descripcion, fecha as fecha_registro FROM horas_trabajo WHERE ticket_id = ? ORDER BY fecha DESC');
    return stmt.all(trimmedId);
};

const getHorasResumenPorTicket = (ticketId) => {
    if (!ticketId) return [];
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        SELECT tecnico as tecnico_nombre, SUM(horas) as total_horas, COUNT(*) as registros
        FROM horas_trabajo
        WHERE ticket_id = ?
        GROUP BY tecnico
    `);
    return stmt.all(trimmedId);
};

const getTotalHorasTicket = (ticketId) => {
    if (!ticketId) return 0;
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare('SELECT SUM(horas) as total FROM horas_trabajo WHERE ticket_id = ?');
    const result = stmt.get(trimmedId);
    return result?.total || 0;
};

const getHorasPorTecnico = (tecnico) => {
    const stmt = db.prepare('SELECT id, ticket_id, tecnico as tecnico_nombre, horas, descripcion, fecha as fecha_registro FROM horas_trabajo WHERE tecnico = ? ORDER BY fecha DESC');
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
    try {
        const { ticket_id, tecnico_id, fecha_cita, descripcion } = data;
        console.log(`[DB] Creating appointment for ticket ${ticket_id}, tech ${tecnico_id}`);

        const stmt = db.prepare(`
            INSERT INTO citas (ticket_id, tecnico_id, fecha_cita, descripcion)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(ticket_id, tecnico_id, fecha_cita, descripcion || '');
        console.log(`[DB] Appointment created with ID: ${result.lastInsertRowid}`);
        return { id: result.lastInsertRowid };
    } catch (error) {
        console.error('[DB] Error in createAppointment:', error);
        throw error;
    }
};

const getAppointmentsByTicket = (ticketId) => {
    if (!ticketId) return [];
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare(`
        SELECT c.*, u.nombre_completo as tecnico_nombre 
        FROM citas c
        JOIN usuarios u ON c.tecnico_id = u.id
        WHERE c.ticket_id = ? 
        ORDER BY c.fecha_cita
    `);
    return stmt.all(trimmedId);
};

const getAppointmentsByTechnician = (tecnicoId) => {
    const stmt = db.prepare(`
        SELECT c.*, t.nombre as cliente_nombre
        FROM citas c
        JOIN tickets t ON c.ticket_id = t.ticket_id
        WHERE c.tecnico_id = ? 
        ORDER BY c.fecha_cita
    `);
    return stmt.all(tecnicoId);
};

const getAllAppointments = () => {
    const stmt = db.prepare(`
        SELECT c.*, u.nombre_completo as tecnico_nombre, t.nombre as cliente_nombre
        FROM citas c
        JOIN usuarios u ON c.tecnico_id = u.id
        JOIN tickets t ON c.ticket_id = t.ticket_id
        ORDER BY c.fecha_cita
    `);
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
    if (!ticketId) return { changes: 0 };
    const trimmedId = ticketId.toString().trim();
    const stmt = db.prepare('UPDATE tickets SET empresa_id = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE ticket_id = ?');
    const result = stmt.run(empresaId, trimmedId);
    return { changes: result.changes };
};

// Password reset functions
const setPasswordResetToken = (username, token, expires) => {
    const stmt = db.prepare('UPDATE usuarios SET reset_token = ?, reset_token_expires = ? WHERE username = ?');
    return stmt.run(token, expires, username);
};

const getUserByResetToken = (token) => {
    const stmt = db.prepare('SELECT * FROM usuarios WHERE reset_token = ? AND reset_token_expires > CURRENT_TIMESTAMP');
    return stmt.get(token);
};

const clearResetToken = (username) => {
    const stmt = db.prepare('UPDATE usuarios SET reset_token = NULL, reset_token_expires = NULL WHERE username = ?');
    return stmt.run(username);
};

// ==================== BACKUP & RESTORE ====================

const exportAllData = () => {
    return {
        usuarios: db.prepare('SELECT * FROM usuarios').all(),
        tickets: db.prepare('SELECT * FROM tickets').all(),
        servicios: db.prepare('SELECT * FROM servicios').all(),
        notas: db.prepare('SELECT * FROM notas').all(),
        empresas: db.prepare('SELECT * FROM empresas').all(),
        materiales: db.prepare('SELECT * FROM materiales').all(),
        whatsapp_contactos: db.prepare('SELECT * FROM whatsapp_contactos').all(),
        facturas: db.prepare('SELECT * FROM facturas').all(),
        factura_items: db.prepare('SELECT * FROM factura_items').all(),
        ticket_materiales: db.prepare('SELECT * FROM ticket_materiales').all(),
        horas_trabajo: db.prepare('SELECT * FROM horas_trabajo').all(),
        citas: db.prepare('SELECT * FROM citas').all()
    };
};

const restoreFromBackup = (data) => {
    const backupTx = db.transaction((data) => {
        // 1. Limpiar todas las tablas
        db.exec('PRAGMA foreign_keys = OFF;');

        const tables = [
            'factura_items', 'ticket_materiales', 'horas_trabajo', 'citas',
            'whatsapp_contactos', 'notas', 'facturas', 'tickets',
            'servicios', 'materiales', 'empresas', 'usuarios'
        ];

        for (const table of tables) {
            db.prepare(`DELETE FROM ${table}`).run();
        }

        // 2. Insertar datos usando parámetros nombrados para robustez
        if (data.usuarios) {
            const stmt = db.prepare(`
                INSERT INTO usuarios (id, username, password_hash, nombre_completo, email, whatsapp, rol, activo, ultimo_acceso, reset_token, reset_token_expires, fecha_creacion)
                VALUES (:id, :username, :password_hash, :nombre_completo, :email, :whatsapp, :rol, :activo, :ultimo_acceso, :reset_token, :reset_token_expires, :fecha_creacion)
            `);
            for (const row of data.usuarios) stmt.run({
                id: null, username: '', password_hash: '', nombre_completo: null, email: null,
                whatsapp: null, rol: 'tecnico', activo: 1, ultimo_acceso: null,
                reset_token: null, reset_token_expires: null, fecha_creacion: new Date().toISOString(),
                ...row
            });
        }

        if (data.empresas) {
            const stmt = db.prepare(`
                INSERT INTO empresas (id, nombre, cif, direccion, telefono, email, activo, verifactu, fecha_creacion)
                VALUES (:id, :nombre, :cif, :direccion, :telefono, :email, :activo, :verifactu, :fecha_creacion)
            `);
            for (const row of data.empresas) stmt.run({
                id: null, nombre: '', cif: null, direccion: null, telefono: null, email: null,
                activo: 1, verifactu: 1, fecha_creacion: new Date().toISOString(),
                ...row
            });
        }

        if (data.materiales) {
            const stmt = db.prepare(`
                INSERT INTO materiales (id, nombre, descripcion, precio, activo, fecha_creacion)
                VALUES (:id, :nombre, :descripcion, :precio, :activo, :fecha_creacion)
            `);
            for (const row of data.materiales) stmt.run({
                id: null, nombre: '', descripcion: '', precio: 0, activo: 1, fecha_creacion: new Date().toISOString(),
                ...row
            });
        }

        if (data.servicios) {
            const stmt = db.prepare(`
                INSERT INTO servicios (id, codigo, nombre, descripcion, activo, archivado, fecha_archivado, usuario_archivado)
                VALUES (:id, :codigo, :nombre, :descripcion, :activo, :archivado, :fecha_archivado, :usuario_archivado)
            `);
            for (const row of data.servicios) stmt.run({
                id: null, codigo: '', nombre: '', descripcion: '', activo: 1, archivado: 0,
                fecha_archivado: null, usuario_archivado: null,
                ...row
            });
        }

        if (data.tickets) {
            const stmt = db.prepare(`
                INSERT INTO tickets (id, ticket_id, nombre, email, telefono, servicio, prioridad, descripcion, estado, tecnico_asignado, empresa_id, fecha_creacion, fecha_actualizacion, archivado, fecha_archivado, usuario_archivado)
                VALUES (:id, :ticket_id, :nombre, :email, :telefono, :servicio, :prioridad, :descripcion, :estado, :tecnico_asignado, :empresa_id, :fecha_creacion, :fecha_actualizacion, :archivado, :fecha_archivado, :usuario_archivado)
            `);
            for (const row of data.tickets) stmt.run({
                id: null, ticket_id: '', nombre: '', email: '', telefono: '', servicio: '', prioridad: 'media',
                descripcion: '', estado: 'pendiente', tecnico_asignado: null, empresa_id: null,
                fecha_creacion: new Date().toISOString(), fecha_actualizacion: new Date().toISOString(),
                archivado: 0, fecha_archivado: null, usuario_archivado: null,
                ...row
            });
        }

        if (data.facturas) {
            const stmt = db.prepare(`
                INSERT INTO facturas (id, factura_id, ticket_id, empresa_id, cliente_nombre, cliente_email, fecha_vencimiento, fecha_emision, subtotal, iva, total, estado, presentada, bloqueada, fecha_presentacion, hash, hash_anterior)
                VALUES (:id, :factura_id, :ticket_id, :empresa_id, :cliente_nombre, :cliente_email, :fecha_vencimiento, :fecha_emision, :subtotal, :iva, :total, :estado, :presentada, :bloqueada, :fecha_presentacion, :hash, :hash_anterior)
            `);
            for (const row of data.facturas) stmt.run({
                id: null, factura_id: '', ticket_id: null, empresa_id: null, cliente_nombre: '', cliente_email: '',
                fecha_vencimiento: null, fecha_emision: new Date().toISOString(), subtotal: 0, iva: 0, total: 0,
                estado: 'borrador', presentada: 0, bloqueada: 0, fecha_presentacion: null, hash: null, hash_anterior: null,
                ...row
            });
        }

        if (data.factura_items) {
            const stmt = db.prepare(`
                INSERT INTO factura_items (id, factura_id, concepto, descripcion, cantidad, precio_unitario, total)
                VALUES (:id, :factura_id, :concepto, :descripcion, :cantidad, :precio_unitario, :total)
            `);
            for (const row of data.factura_items) stmt.run({
                id: null, factura_id: '', concepto: '', descripcion: '', cantidad: 0, precio_unitario: 0, total: 0,
                ...row
            });
        }

        if (data.ticket_materiales) {
            const stmt = db.prepare(`
                INSERT INTO ticket_materiales (id, ticket_id, material_id, cantidad, precio_unitario, registrado_por, fecha_registro)
                VALUES (:id, :ticket_id, :material_id, :cantidad, :precio_unitario, :registrado_por, :fecha_registro)
            `);
            for (const row of data.ticket_materiales) stmt.run({
                id: null, ticket_id: '', material_id: 0, cantidad: 0, precio_unitario: 0, registrado_por: null, fecha_registro: new Date().toISOString(),
                ...row
            });
        }

        if (data.horas_trabajo) {
            const stmt = db.prepare(`
                INSERT INTO horas_trabajo (id, ticket_id, tecnico, tecnico_id, horas, descripcion, fecha)
                VALUES (:id, :ticket_id, :tecnico, :tecnico_id, :horas, :descripcion, :fecha)
            `);
            for (const row of data.horas_trabajo) stmt.run({
                id: null, ticket_id: '', tecnico: null, tecnico_id: null, horas: 0, descripcion: '', fecha: new Date().toISOString(),
                ...row
            });
        }

        if (data.notas) {
            const stmt = db.prepare(`
                INSERT INTO notas (id, ticket_id, nota, autor, fecha_creacion, archivado, fecha_archivado, usuario_archivado)
                VALUES (:id, :ticket_id, :nota, :autor, :fecha_creacion, :archivado, :fecha_archivado, :usuario_archivado)
            `);
            for (const row of data.notas) stmt.run({
                id: null, ticket_id: '', nota: '', autor: '', fecha_creacion: new Date().toISOString(),
                archivado: 0, fecha_archivado: null, usuario_archivado: null,
                ...row
            });
        }

        if (data.whatsapp_contactos) {
            const stmt = db.prepare(`
                INSERT INTO whatsapp_contactos (id, ticket_id, telefono, mensaje, enviado_por, fecha_contacto)
                VALUES (:id, :ticket_id, :telefono, :mensaje, :enviado_por, :fecha_contacto)
            `);
            for (const row of data.whatsapp_contactos) stmt.run({
                id: null, ticket_id: '', telefono: '', mensaje: null, enviado_por: '', fecha_contacto: new Date().toISOString(),
                ...row
            });
        }

        if (data.citas) {
            const stmt = db.prepare(`
                INSERT INTO citas (id, ticket_id, tecnico_id, fecha_cita, duracion, estado, descripcion, fecha_creacion)
                VALUES (:id, :ticket_id, :tecnico_id, :fecha_cita, :duracion, :estado, :descripcion, :fecha_creacion)
            `);
            for (const row of data.citas) stmt.run({
                id: null, ticket_id: '', tecnico_id: 0, fecha_cita: new Date().toISOString(), duracion: 60,
                estado: 'programada', descripcion: '', fecha_creacion: new Date().toISOString(),
                ...row
            });
        }

        db.exec('PRAGMA foreign_keys = ON;');
        return { success: true };
    });

    return backupTx(data);
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
    getArchivedTickets,
    getTicketById,
    updateTicketStatus,

    updateTicket,
    archiveTicket,
    restoreTicket,
    deleteTicket,
    getTicketsByStatus,
    assignTechnician,
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
    // Notas complementarias
    archiveNote,
    restoreNote,
    deleteNote,
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
    getDraftInvoicesByEmpresa,
    appendItemsToInvoice,
    presentarInvoice,
    deleteInvoice,
    createMultiTicketInvoice,
    getTicketsForInvoice,
    // Horas de trabajo
    addHorasTrabajo,
    getHorasTrabajo,
    getTotalHorasTicket,
    getHorasResumenPorTicket,
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
    setPasswordResetToken,
    getUserByResetToken,
    clearResetToken,
    transferirTicketEmpresa,
    // Backup & Restore
    exportAllData,
    restoreFromBackup,
    db

};
