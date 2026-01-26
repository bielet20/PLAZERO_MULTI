const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const dbPath = path.join(dataDir, 'tickets.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create tickets table
            db.run(`
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
            `, (err) => {
                if (err) {
                    console.error('Error creating tickets table:', err);
                    reject(err);
                } else {
                    console.log('✓ Tabla de tickets creada/verificada');
                }
                // Add columns if they don't exist
                db.run(`ALTER TABLE tickets ADD COLUMN archivado INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE tickets ADD COLUMN fecha_archivado DATETIME`, () => {});
                db.run(`ALTER TABLE tickets ADD COLUMN usuario_archivado TEXT`, () => {});
            });

            // Create services table for reference
            db.run(`
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
            `, (err) => {
                if (err) {
                    console.error('Error creating services table:', err);
                } else {
                    console.log('✓ Tabla de servicios creada/verificada');
                }
            });

            // Create notes table for internal comments
            db.run(`
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
            `, (err) => {
                if (err) {
                    console.error('Error creating notes table:', err);
                } else {
                    console.log('✓ Tabla de notas creada/verificada');
                }
                // Add columns if they don't exist
                db.run(`ALTER TABLE notas ADD COLUMN archivado INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE notas ADD COLUMN fecha_archivado DATETIME`, () => {});
                db.run(`ALTER TABLE notas ADD COLUMN usuario_archivado TEXT`, () => {});
            });

            // Add columns for assignment if they don't exist
            db.run(`ALTER TABLE tickets ADD COLUMN tecnico_asignado TEXT`, (err) => {
                // Ignore error if column already exists
            });

            // Create WhatsApp contacts table
            db.run(`
                CREATE TABLE IF NOT EXISTS whatsapp_contactos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    telefono TEXT NOT NULL,
                    mensaje TEXT,
                    enviado_por TEXT NOT NULL,
                    fecha_contacto DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating whatsapp_contactos table:', err);
                } else {
                    console.log('✓ Tabla de contactos WhatsApp creada/verificada');
                }
            });

            // Create empresas table
            db.run(`
                CREATE TABLE IF NOT EXISTS empresas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT UNIQUE NOT NULL,
                    cif TEXT,
                    direccion TEXT,
                    telefono TEXT,
                    email TEXT,
                    activo INTEGER DEFAULT 1,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating empresas table:', err);
                } else {
                    console.log('✓ Tabla de empresas creada/verificada');
                }
            });

            // Add empresa_id column to tickets if it doesn't exist
            db.run(`ALTER TABLE tickets ADD COLUMN empresa_id INTEGER REFERENCES empresas(id)`, () => {});

            // Create users table
            db.run(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    nombre_completo TEXT,
                    email TEXT,
                    rol TEXT DEFAULT 'tecnico',
                    activo INTEGER DEFAULT 1,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ultimo_acceso DATETIME
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating usuarios table:', err);
                } else {
                    console.log('✓ Tabla de usuarios creada/verificada');
                }
            });
            
            // Create horas_trabajo table separately
            db.run(`
                CREATE TABLE IF NOT EXISTS horas_trabajo (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    usuario_id INTEGER NOT NULL,
                    tecnico_nombre TEXT NOT NULL,
                    horas REAL NOT NULL,
                    descripcion TEXT,
                    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                    registrado_por TEXT NOT NULL,
                    FOREIGN KEY(ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
                )
            `, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.error('Error creating horas_trabajo table:', err);
                } else if (!err) {
                    console.log('✓ Tabla de horas de trabajo creada/verificada');
                }
            });

            // Create materiales table
            db.run(`
                CREATE TABLE IF NOT EXISTS materiales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT UNIQUE NOT NULL,
                    descripcion TEXT,
                    precio REAL NOT NULL DEFAULT 0,
                    activo INTEGER DEFAULT 1
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating materiales table:', err);
                } else {
                    console.log('✓ Tabla de materiales creada/verificada');
                }
            });

            // Create ticket_materiales table
            db.run(`
                CREATE TABLE IF NOT EXISTS ticket_materiales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT NOT NULL,
                    material_id INTEGER NOT NULL,
                    cantidad REAL NOT NULL DEFAULT 1,
                    precio_unitario REAL NOT NULL,
                    registrado_por TEXT NOT NULL,
                    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY (material_id) REFERENCES materiales(id)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating ticket_materiales table:', err);
                } else {
                    console.log('✓ Tabla de ticket_materiales creada/verificada');
                }
            });

            // Create facturas table
            db.run(`
                CREATE TABLE IF NOT EXISTS facturas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    factura_id TEXT UNIQUE NOT NULL,
                    ticket_id TEXT NOT NULL,
                    empresa_id INTEGER,
                    cliente_nombre TEXT NOT NULL,
                    cliente_email TEXT,
                    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_vencimiento DATETIME,
                    subtotal REAL NOT NULL,
                    iva REAL NOT NULL,
                    total REAL NOT NULL,
                    estado TEXT DEFAULT 'pendiente', -- pendiente, pagada, anulada
                    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
                    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
                )
            `, (err) => {
                if (err) console.error('Error creating facturas table:', err);
                else console.log('✓ Tabla de facturas creada/verificada');
                // Add empresa_id column if it doesn't exist
                db.run(`ALTER TABLE facturas ADD COLUMN empresa_id INTEGER REFERENCES empresas(id)`, () => {});
            });

            // Create factura_items table
            db.run(`
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
            `, (err) => {
                if (err) console.error('Error creating factura_items table:', err);
                else console.log('✓ Tabla de factura_items creada/verificada');
            });

            // Create factura_tickets table (relación muchos a muchos)
            db.run(`
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
            `, (err) => {
                if (err) console.error('Error creating factura_tickets table:', err);
                else console.log('✓ Tabla de factura_tickets creada/verificada');
            });

            // Insert default services if table is empty
            db.get('SELECT COUNT(*) as count FROM servicios', (err, row) => {
                if (!err && row.count === 0) {
                    const services = [
                        ['reparacion', 'Reparación de Equipos', 'Diagnóstico y reparación de computadoras y dispositivos'],
                        ['redes', 'Montaje de Redes', 'Instalación y configuración de redes'],
                        ['impresoras', 'Soporte de Impresoras', 'Mantenimiento y reparación de impresoras'],
                        ['seguridad', 'Seguridad Informática', 'Protección y seguridad de sistemas'],
                        ['errores', 'Detección de Errores', 'Diagnóstico de problemas de software y hardware'],
                        ['soporte', 'Soporte Técnico General', 'Asistencia técnica general'],
                        ['desarrollo_app', 'Programación de Aplicaciones Personalizadas', 'Desarrollo de software a medida para sus necesidades específicas'],
                        ['desarrollo_web', 'Desarrollo de Entornos Web', 'Creación de páginas web, tiendas online y aplicaciones web']
                    ];

                    const stmt = db.prepare('INSERT INTO servicios (codigo, nombre, descripcion) VALUES (?, ?, ?)');
                    services.forEach(service => {
                        stmt.run(service);
                    });
                    stmt.finalize();
                    console.log('✓ Servicios predeterminados insertados');
                }
            });

            resolve();
        });
    });
};

// ==================== FACTURACIÓN ====================

const generateInvoiceId = () => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString(36).toUpperCase();
    return `FAC-${year}-${timestamp}`;
};

const createInvoice = (invoiceData) => {
    return new Promise((resolve, reject) => {
        const invoiceId = generateInvoiceId();
        const { ticket_id, cliente_nombre, cliente_email, fecha_vencimiento, subtotal, iva, total, items } = invoiceData;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const invoiceSql = `
                INSERT INTO facturas (factura_id, ticket_id, cliente_nombre, cliente_email, fecha_vencimiento, subtotal, iva, total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(invoiceSql, [invoiceId, ticket_id, cliente_nombre, cliente_email, fecha_vencimiento, subtotal, iva, total], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }

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
                    db.run('COMMIT');
                    resolve({ id: this.lastID, invoiceId });
                });
            });
        });
    });
};

const getInvoiceById = (invoiceId) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM facturas WHERE factura_id = ?';
        db.get(sql, [invoiceId], (err, invoice) => {
            if (err) return reject(err);
            if (!invoice) return resolve(null);

            const itemsSql = 'SELECT * FROM factura_items WHERE factura_id = ?';
            db.all(itemsSql, [invoiceId], (err, items) => {
                if (err) return reject(err);
                invoice.items = items;
                resolve(invoice);
            });
        });
    });
};

const getInvoicesByTicketId = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM facturas WHERE ticket_id = ? ORDER BY fecha_emision DESC';
        db.all(sql, [ticketId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};


// Generate unique ticket ID
const generateTicketId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TKT-${timestamp}-${random}`;
};

// Create new ticket
const createTicket = (ticketData) => {
    return new Promise((resolve, reject) => {
        const ticketId = generateTicketId();
        const { nombre, email, telefono, servicio, prioridad, descripcion, empresa_id } = ticketData;

        const sql = `
            INSERT INTO tickets (ticket_id, nombre, email, telefono, servicio, prioridad, descripcion, empresa_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [ticketId, nombre, email, telefono, servicio, prioridad, descripcion, empresa_id || null], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    id: this.lastID,
                    ticketId: ticketId
                });
            }
        });
    });
};

// Get all tickets (no archived)
const getAllTickets = () => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM tickets WHERE archivado = 0 ORDER BY fecha_creacion DESC';
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Get all archived tickets
const getArchivedTickets = () => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM tickets WHERE archivado = 1 ORDER BY fecha_archivado DESC';
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Get ticket by ID
const getTicketById = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM tickets WHERE ticket_id = ?';
        db.get(sql, [ticketId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

// Update ticket status
const updateTicketStatus = (ticketId, estado) => {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE tickets 
            SET estado = ?, fecha_actualizacion = CURRENT_TIMESTAMP 
            WHERE ticket_id = ?
        `;
        db.run(sql, [estado, ticketId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Update complete ticket (full edit)
const updateTicket = (ticketId, ticketData) => {
    return new Promise((resolve, reject) => {
        const { nombre, email, telefono, servicio, prioridad, descripcion, estado, tecnico_asignado, empresa_id } = ticketData;
        const sql = `
            UPDATE tickets 
            SET nombre = ?, email = ?, telefono = ?, servicio = ?, prioridad = ?, descripcion = ?, estado = ?, tecnico_asignado = ?, empresa_id = ?, fecha_actualizacion = CURRENT_TIMESTAMP 
            WHERE ticket_id = ?
        `;
        db.run(sql, [nombre, email, telefono, servicio, prioridad, descripcion, estado, tecnico_asignado, empresa_id || null, ticketId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Archive ticket (soft delete)
const archiveTicket = (ticketId, usuario) => {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE tickets 
            SET archivado = 1, fecha_archivado = CURRENT_TIMESTAMP, usuario_archivado = ?
            WHERE ticket_id = ?
        `;
        db.run(sql, [usuario, ticketId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Restore archived ticket
const restoreTicket = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE tickets 
            SET archivado = 0, fecha_archivado = NULL, usuario_archivado = NULL
            WHERE ticket_id = ?
        `;
        db.run(sql, [ticketId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Delete ticket (permanent - only after archive)
const deleteTicket = (ticketId) => {
    return new Promise((resolve, reject) => {
        // First delete related notes
        db.run('DELETE FROM notas WHERE ticket_id = ?', [ticketId], (err1) => {
            if (err1) {
                reject(err1);
                return;
            }
            // Then delete related whatsapp contacts
            db.run('DELETE FROM whatsapp_contactos WHERE ticket_id = ?', [ticketId], (err2) => {
                if (err2) {
                    reject(err2);
                    return;
                }
                // Finally delete the ticket
                db.run('DELETE FROM tickets WHERE ticket_id = ?', [ticketId], function(err3) {
                    if (err3) {
                        reject(err3);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        });
    });
};

// Get tickets by status
const getTicketsByStatus = (estado) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM tickets WHERE estado = ? AND archivado = 0 ORDER BY fecha_creacion DESC';
        db.all(sql, [estado], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Add note to ticket
const addNoteToTicket = (ticketId, nota, autor) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO notas (ticket_id, nota, autor) VALUES (?, ?, ?)';
        db.run(sql, [ticketId, nota, autor], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
};

// Archive note (soft delete)
const archiveNote = (noteId, usuario) => {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE notas 
            SET archivado = 1, fecha_archivado = CURRENT_TIMESTAMP, usuario_archivado = ?
            WHERE id = ?
        `;
        db.run(sql, [usuario, noteId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Restore archived note
const restoreNote = (noteId) => {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE notas 
            SET archivado = 0, fecha_archivado = NULL, usuario_archivado = NULL
            WHERE id = ?
        `;
        db.run(sql, [noteId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Delete note (permanent)
const deleteNote = (noteId) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM notas WHERE id = ?';
        db.run(sql, [noteId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Get notes for ticket (no archived)
const getTicketNotes = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM notas WHERE ticket_id = ? AND archivado = 0 ORDER BY fecha_creacion DESC';
        db.all(sql, [ticketId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Assign technician to ticket
const assignTechnician = (ticketId, tecnico) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE tickets SET tecnico_asignado = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE ticket_id = ?';
        db.run(sql, [tecnico, ticketId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Get all services
const getAllServices = () => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM servicios ORDER BY nombre';
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Create service
const createService = (codigo, nombre, descripcion) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO servicios (codigo, nombre, descripcion, activo) VALUES (?, ?, ?, 1)';
        db.run(sql, [codigo, nombre, descripcion], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
};

// Update service
const updateService = (serviceId, codigo, nombre, descripcion, activo) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE servicios SET codigo = ?, nombre = ?, descripcion = ?, activo = ? WHERE id = ?';
        db.run(sql, [codigo, nombre, descripcion, activo, serviceId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Delete service
const deleteService = (serviceId) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM servicios WHERE id = ?';
        db.run(sql, [serviceId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// ==================== MATERIALES ====================

// Get all materials
const getAllMaterials = () => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM materiales WHERE activo = 1 ORDER BY nombre';
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Get material by ID
const getMaterialById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM materiales WHERE id = ?';
        db.get(sql, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Create a new material
const createMaterial = (nombre, descripcion, precio) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO materiales (nombre, descripcion, precio) VALUES (?, ?, ?)';
        db.run(sql, [nombre, descripcion, precio], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
        });
    });
};

// Update a material
const updateMaterial = (id, nombre, descripcion, precio, activo) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE materiales SET nombre = ?, descripcion = ?, precio = ?, activo = ? WHERE id = ?';
        db.run(sql, [nombre, descripcion, precio, activo, id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
};

// Delete a material
const deleteMaterial = (id) => {
    return new Promise((resolve, reject) => {
        // Primero, verificar que no esté en uso en ningún ticket
        db.get('SELECT COUNT(*) as count FROM ticket_materiales WHERE material_id = ?', [id], (err, row) => {
            if (err) return reject(err);
            if (row.count > 0) {
                return reject(new Error('El material está en uso y no puede ser eliminado. Desactívelo en su lugar.'));
            }
            
            // Si no está en uso, eliminar
            const sql = 'DELETE FROM materiales WHERE id = ?';
            db.run(sql, [id], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    });
};


// ==================== TICKET-MATERIALES ====================

// Add material to a ticket
const addMaterialToTicket = (ticketId, materialId, cantidad, precioUnitario, registradoPor) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO ticket_materiales (ticket_id, material_id, cantidad, precio_unitario, registrado_por) VALUES (?, ?, ?, ?, ?)';
        db.run(sql, [ticketId, materialId, cantidad, precioUnitario, registradoPor], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
        });
    });
};

// Get all materials for a given ticket
const getMaterialsForTicket = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT tm.id, tm.cantidad, tm.precio_unitario, tm.fecha_registro, m.nombre, m.id as material_id
            FROM ticket_materiales tm
            JOIN materiales m ON tm.material_id = m.id
            WHERE tm.ticket_id = ?
            ORDER BY tm.fecha_registro DESC
        `;
        db.all(sql, [ticketId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Remove a material from a ticket
const removeMaterialFromTicket = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM ticket_materiales WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
};


const registerWhatsAppContact = (ticketId, telefono, mensaje, enviadoPor) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO whatsapp_contactos (ticket_id, telefono, mensaje, enviado_por) VALUES (?, ?, ?, ?)';
        db.run(sql, [ticketId, telefono, mensaje, enviadoPor], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
};

// Get WhatsApp contacts for ticket
const getWhatsAppContacts = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM whatsapp_contactos WHERE ticket_id = ? ORDER BY fecha_contacto DESC';
        db.all(sql, [ticketId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// ==================== USUARIOS ====================

// Get all users
const getAllUsers = () => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT id, username, nombre_completo, email, rol, activo, fecha_creacion, ultimo_acceso FROM usuarios ORDER BY username';
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Get user by username
const getUserByUsername = (username) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM usuarios WHERE username = ?';
        db.get(sql, [username], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

// Create user
const createUser = (username, passwordHash, nombreCompleto, email, rol = 'tecnico') => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol) VALUES (?, ?, ?, ?, ?)';
        db.run(sql, [username, passwordHash, nombreCompleto, email, rol], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
};

// Update user
const updateUser = (id, data) => {
    return new Promise((resolve, reject) => {
        const fields = [];
        const values = [];
        
        if (data.nombre_completo !== undefined) {
            fields.push('nombre_completo = ?');
            values.push(data.nombre_completo);
        }
        if (data.email !== undefined) {
            fields.push('email = ?');
            values.push(data.email);
        }
        if (data.rol !== undefined) {
            fields.push('rol = ?');
            values.push(data.rol);
        }
        if (data.activo !== undefined) {
            fields.push('activo = ?');
            values.push(data.activo);
        }
        if (data.password_hash !== undefined) {
            fields.push('password_hash = ?');
            values.push(data.password_hash);
        }
        
        if (fields.length === 0) {
            return resolve({ changes: 0 });
        }
        
        values.push(id);
        const sql = `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`;
        
        db.run(sql, values, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Update last access
const updateUserLastAccess = (username) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE username = ?';
        db.run(sql, [username], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Delete user
const deleteUser = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM usuarios WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// ==================== TRABAJO POR HORAS ====================

// Add hours worked on a ticket
const addHorasTrabajo = (ticketId, usuarioId, tecnicoNombre, horas, descripcion, registradoPor) => {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO horas_trabajo 
            (ticket_id, usuario_id, tecnico_nombre, horas, descripcion, registrado_por) 
            VALUES (?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [ticketId, usuarioId, tecnicoNombre, horas, descripcion || '', registradoPor], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
};

// Get hours worked on a ticket
const getHorasTrabajo = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM horas_trabajo WHERE ticket_id = ? ORDER BY fecha_registro DESC`;
        
        db.all(sql, [ticketId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
};

// Get total hours for a ticket
const getTotalHorasTicket = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT SUM(horas) as total FROM horas_trabajo WHERE ticket_id = ?`;
        
        db.get(sql, [ticketId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row?.total || 0);
            }
        });
    });
};

// Get hours by technician for a ticket
const getHorasPorTecnico = (ticketId) => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT tecnico_nombre, SUM(horas) as total_horas, COUNT(*) as registros 
                     FROM horas_trabajo 
                     WHERE ticket_id = ? 
                     GROUP BY tecnico_nombre 
                     ORDER BY total_horas DESC`;
        
        db.all(sql, [ticketId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
};

// Update hours entry
const updateHorasTrabajo = (id, horas, descripcion) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE horas_trabajo SET horas = ?, descripcion = ? WHERE id = ?`;
        
        db.run(sql, [horas, descripcion || '', id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// Delete hours entry
const deleteHorasTrabajo = (id) => {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM horas_trabajo WHERE id = ?`;
        
        db.run(sql, [id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

// ==================== EMPRESAS ====================

const getAllEmpresas = () => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM empresas ORDER BY nombre';
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getEmpresaById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM empresas WHERE id = ?';
        db.get(sql, [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const createEmpresa = (nombre, cif, direccion, telefono, email) => {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO empresas (nombre, cif, direccion, telefono, email)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.run(sql, [nombre, cif, direccion, telefono, email], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
};

const updateEmpresa = (id, nombre, cif, direccion, telefono, email, activo) => {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE empresas 
            SET nombre = ?, cif = ?, direccion = ?, telefono = ?, email = ?, activo = ?
            WHERE id = ?
        `;
        db.run(sql, [nombre, cif, direccion, telefono, email, activo, id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

const deleteEmpresa = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM empresas WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

const transferirTicketEmpresa = (ticketId, nuevaEmpresaId) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE tickets SET empresa_id = ? WHERE ticket_id = ?';
        db.run(sql, [nuevaEmpresaId, ticketId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

module.exports = {
    db,
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
    addHorasTrabajo,
    getHorasTrabajo,
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
    // Empresas
    getAllEmpresas,
    getEmpresaById,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    transferirTicketEmpresa
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
            db.run(invoiceSql, [invoiceId, ticket_ids[0], cliente_nombre, cliente_email, fecha_vencimiento, subtotal, iva, total, empresa_id || null], function(err) {
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
    db,
    initDatabase,
    // Tickets
    getAllTickets,
    getTicketById,
    getArchivedTickets,
    createTicket,
    updateTicket,
    archiveTicket,
    restoreTicket,
    deleteTicket,
    // Notas
    addNote,
    getNotes,
    // Horas de trabajo
    addHorasTrabajo,
    getHorasTrabajo,
    getTotalHorasTicket,
    getHorasPorTecnico,
    updateHorasTrabajo,
    deleteHorasTrabajo,
    // Servicios
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
    // Empresas
    getAllEmpresas,
    getEmpresaById,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
    transferirTicketEmpresa
};
