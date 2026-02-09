const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

console.log('🎯 Creando datos de prueba completos...\n');

const db = new Database('tickets.db');

// Primero, necesitamos que la base de datos se inicialice
// Vamos a iniciar el servidor brevemente para que cree las tablas
console.log('⚠️  IMPORTANTE: Asegúrate de que el servidor se ha iniciado al menos una vez para crear las tablas.\n');

try {
    // ============================================
    // 1. CREAR USUARIOS DE PRUEBA
    // ============================================
    console.log('👥 Creando usuarios de prueba...');

    const usuarios = [
        { username: 'admin', password: 'Admin123!@#$', nombre: 'Administrador Principal', email: 'admin@fontplazero.com', whatsapp: '654892803', rol: 'admin' },
        { username: 'root', password: 'Root_2026', nombre: 'Root User', email: 'root@fontplazero.com', whatsapp: '654892804', rol: 'admin' },
        { username: 'tecnico1', password: 'Tecnico123!', nombre: 'Juan Pérez', email: 'juan@fontplazero.com', whatsapp: '654892805', rol: 'tecnico' },
        { username: 'tecnico2', password: 'Tecnico123!', nombre: 'María García', email: 'maria@fontplazero.com', whatsapp: '654892806', rol: 'tecnico' },
        { username: 'manager', password: 'Manager123!', nombre: 'Carlos Rodríguez', email: 'carlos@fontplazero.com', whatsapp: '654892807', rol: 'manager' },
    ];

    const insertUser = db.prepare(`
        INSERT INTO usuarios (username, password_hash, nombre_completo, email, whatsapp, rol, activo)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    for (const user of usuarios) {
        const hash = bcrypt.hashSync(user.password, 10);
        try {
            insertUser.run(user.username, hash, user.nombre, user.email, user.whatsapp, user.rol);
            console.log(`  ✅ Usuario creado: ${user.username} (${user.rol})`);
        } catch (err) {
            console.log(`  ⚠️  Usuario ya existe: ${user.username}`);
        }
    }

    // ============================================
    // 2. CREAR EMPRESAS/CLIENTES DE PRUEBA
    // ============================================
    console.log('\n🏢 Creando empresas/clientes de prueba...');

    const empresas = [
        { nombre: 'Hotel Bella Vista', cif: 'B12345678', direccion: 'Calle Mayor 123, Palma', telefono: '971123456', email: 'info@bellavista.com' },
        { nombre: 'Restaurante El Pescador', cif: 'B23456789', direccion: 'Paseo Marítimo 45, Palma', telefono: '971234567', email: 'contacto@elpescador.com' },
        { nombre: 'Apartamentos Sol y Mar', cif: 'B34567890', direccion: 'Avenida del Mar 78, Alcúdia', telefono: '971345678', email: 'reservas@solimar.com' },
        { nombre: 'Cafetería Central', cif: 'B45678901', direccion: 'Plaza España 12, Palma', telefono: '971456789', email: 'info@cafecentral.com' },
        { nombre: 'Supermercado La Estrella', cif: 'B56789012', direccion: 'Calle Comercio 56, Inca', telefono: '971567890', email: 'gerencia@laestrella.com' },
        { nombre: 'Gimnasio FitLife', cif: 'B67890123', direccion: 'Avenida Fitness 34, Palma', telefono: '971678901', email: 'info@fitlife.com' },
        { nombre: 'Peluquería Estilo', cif: 'B78901234', direccion: 'Calle Belleza 23, Manacor', telefono: '971789012', email: 'citas@estilo.com' },
        { nombre: 'Farmacia San Juan', cif: 'B89012345', direccion: 'Plaza San Juan 5, Palma', telefono: '971890123', email: 'farmacia@sanjuan.com' },
        { nombre: 'Taller Mecánico AutoFix', cif: 'B90123456', direccion: 'Polígono Industrial 12, Palma', telefono: '971901234', email: 'taller@autofix.com' },
        { nombre: 'Librería El Saber', cif: 'B01234567', direccion: 'Calle Cultura 67, Palma', telefono: '971012345', email: 'libros@elsaber.com' },
    ];

    const insertEmpresa = db.prepare(`
        INSERT OR IGNORE INTO empresas (nombre, cif, direccion, telefono, email, activo, verifactu)
        VALUES (?, ?, ?, ?, ?, 1, 1)
    `);

    for (const empresa of empresas) {
        // Check if company already exists to provide better log
        const existing = db.prepare('SELECT id FROM empresas WHERE nombre = ? OR cif = ?').get(empresa.nombre, empresa.cif);
        if (existing) {
            console.log(`  ⚠️  Empresa ya existe: ${empresa.nombre}`);
        } else {
            insertEmpresa.run(empresa.nombre, empresa.cif, empresa.direccion, empresa.telefono, empresa.email);
            console.log(`  ✅ Empresa creada: ${empresa.nombre}`);
        }
    }

    // ============================================
    // 3. CREAR SERVICIOS/ARTÍCULOS DE PRUEBA
    // ============================================
    console.log('\n🛠️  Creando servicios/artículos de prueba...');

    const servicios = [
        { codigo: 'FUGA-001', nombre: 'Detección de fugas', descripcion: 'Servicio de detección de fugas de agua con equipamiento especializado' },
        { codigo: 'REP-001', nombre: 'Reparación de tuberías', descripcion: 'Reparación de tuberías dañadas o con fugas' },
        { codigo: 'INST-001', nombre: 'Instalación de fontanería', descripcion: 'Instalación completa de sistemas de fontanería' },
        { codigo: 'MANT-001', nombre: 'Mantenimiento preventivo', descripcion: 'Mantenimiento preventivo de instalaciones' },
        { codigo: 'DESAT-001', nombre: 'Desatasco de tuberías', descripcion: 'Servicio de desatasco de tuberías y desagües' },
        { codigo: 'CALEF-001', nombre: 'Reparación de calefacción', descripcion: 'Reparación de sistemas de calefacción' },
        { codigo: 'CLIMA-001', nombre: 'Instalación de climatización', descripcion: 'Instalación de sistemas de aire acondicionado' },
        { codigo: 'ELEC-001', nombre: 'Reparación eléctrica', descripcion: 'Reparación de instalaciones eléctricas' },
        { codigo: 'PINTURA-001', nombre: 'Servicio de pintura', descripcion: 'Pintura interior y exterior' },
        { codigo: 'ALBA-001', nombre: 'Albañilería general', descripcion: 'Trabajos de albañilería y construcción' },
        { codigo: 'CARP-001', nombre: 'Carpintería', descripcion: 'Trabajos de carpintería y ebanistería' },
        { codigo: 'CRISTAL-001', nombre: 'Cristalería', descripcion: 'Instalación y reparación de cristales' },
        { codigo: 'JARDIN-001', nombre: 'Jardinería', descripcion: 'Mantenimiento de jardines y zonas verdes' },
        { codigo: 'LIMP-001', nombre: 'Limpieza profunda', descripcion: 'Servicio de limpieza profunda' },
        { codigo: 'PEST-001', nombre: 'Control de plagas', descripcion: 'Servicio de control y eliminación de plagas' },
        { codigo: 'SEG-001', nombre: 'Instalación de seguridad', descripcion: 'Instalación de sistemas de seguridad y alarmas' },
        { codigo: 'CERR-001', nombre: 'Cerrajería', descripcion: 'Servicios de cerrajería y apertura de puertas' },
        { codigo: 'PISCINA-001', nombre: 'Mantenimiento de piscinas', descripcion: 'Mantenimiento y limpieza de piscinas' },
        { codigo: 'TEJADO-001', nombre: 'Reparación de tejados', descripcion: 'Reparación de tejados y cubiertas' },
        { codigo: 'EMERG-001', nombre: 'Servicio de emergencia 24h', descripcion: 'Servicio de emergencia disponible 24 horas' },
    ];

    const insertServicio = db.prepare(`
        INSERT OR IGNORE INTO servicios (codigo, nombre, descripcion, activo)
        VALUES (?, ?, ?, 1)
    `);

    for (const servicio of servicios) {
        const existing = db.prepare('SELECT id FROM servicios WHERE codigo = ?').get(servicio.codigo);
        if (existing) {
            console.log(`  ⚠️  Servicio ya existe: ${servicio.nombre}`);
        } else {
            insertServicio.run(servicio.codigo, servicio.nombre, servicio.descripcion);
            console.log(`  ✅ Servicio creado: ${servicio.nombre}`);
        }
    }

    // ============================================
    // 4. CREAR MATERIALES DE PRUEBA
    // ============================================
    console.log('\n📦 Creando materiales de prueba...');

    const materiales = [
        { nombre: 'Tubería PVC 20mm', descripcion: 'Tubería de PVC de 20mm de diámetro', precio: 5.50 },
        { nombre: 'Codo PVC 90°', descripcion: 'Codo de PVC de 90 grados', precio: 2.30 },
        { nombre: 'Válvula de paso', descripcion: 'Válvula de paso de 1/2 pulgada', precio: 12.50 },
        { nombre: 'Grifo monomando', descripcion: 'Grifo monomando cromado', precio: 45.00 },
        { nombre: 'Silicona sanitaria', descripcion: 'Cartucho de silicona sanitaria', precio: 6.80 },
        { nombre: 'Cinta de teflón', descripcion: 'Rollo de cinta de teflón', precio: 1.50 },
        { nombre: 'Llave inglesa', descripcion: 'Llave inglesa ajustable 12"', precio: 18.90 },
        { nombre: 'Desatascador', descripcion: 'Desatascador de goma profesional', precio: 8.50 },
        { nombre: 'Cable eléctrico 2.5mm', descripcion: 'Cable eléctrico de 2.5mm por metro', precio: 1.20 },
        { nombre: 'Interruptor doble', descripcion: 'Interruptor doble empotrable', precio: 7.50 },
    ];

    const insertMaterial = db.prepare(`
        INSERT INTO materiales (nombre, descripcion, precio, activo)
        VALUES (?, ?, ?, 1)
    `);

    for (const material of materiales) {
        const existing = db.prepare('SELECT id FROM materiales WHERE nombre = ?').get(material.nombre);
        if (existing) {
            console.log(`  ⚠️  Material ya existe: ${material.nombre}`);
        } else {
            insertMaterial.run(material.nombre, material.descripcion, material.precio);
            console.log(`  ✅ Material creado: ${material.nombre}`);
        }
    }

    // ============================================
    // 5. CREAR TICKETS DE PRUEBA
    // ============================================
    console.log('\n🎫 Creando tickets de prueba...');

    const tickets = [
        { nombre: 'Ana Martínez', email: 'ana@example.com', telefono: '612345678', servicio: 'Detección de fugas', descripcion: 'Tenemos una fuga de agua en el baño principal', prioridad: 'alta', estado: 'pendiente', empresa_id: 1 },
        { nombre: 'Pedro López', email: 'pedro@example.com', telefono: '623456789', servicio: 'Reparación de tuberías', descripcion: 'Tubería rota en la cocina', prioridad: 'urgente', estado: 'en_proceso', empresa_id: 2 },
        { nombre: 'Laura Sánchez', email: 'laura@example.com', telefono: '634567890', servicio: 'Instalación de fontanería', descripcion: 'Necesito instalar un nuevo baño', prioridad: 'media', estado: 'pendiente', empresa_id: 3 },
        { nombre: 'Miguel Torres', email: 'miguel@example.com', telefono: '645678901', servicio: 'Mantenimiento preventivo', descripcion: 'Mantenimiento anual de las instalaciones', prioridad: 'baja', estado: 'completado', empresa_id: 4 },
        { nombre: 'Carmen Ruiz', email: 'carmen@example.com', telefono: '656789012', servicio: 'Desatasco de tuberías', descripcion: 'Desagüe atascado en el fregadero', prioridad: 'alta', estado: 'en_proceso', empresa_id: 5 },
        { nombre: 'José Fernández', email: 'jose@example.com', telefono: '667890123', servicio: 'Reparación de calefacción', descripcion: 'La calefacción no funciona correctamente', prioridad: 'urgente', estado: 'pendiente', empresa_id: 6 },
        { nombre: 'Isabel Moreno', email: 'isabel@example.com', telefono: '678901234', servicio: 'Instalación de climatización', descripcion: 'Quiero instalar aire acondicionado en 3 habitaciones', prioridad: 'media', estado: 'pendiente', empresa_id: 7 },
        { nombre: 'Francisco Jiménez', email: 'francisco@example.com', telefono: '689012345', servicio: 'Reparación eléctrica', descripcion: 'Varios enchufes no funcionan', prioridad: 'alta', estado: 'completado', empresa_id: 8 },
        { nombre: 'Rosa Navarro', email: 'rosa@example.com', telefono: '690123456', servicio: 'Servicio de pintura', descripcion: 'Pintar el salón y dos dormitorios', prioridad: 'baja', estado: 'archivado', empresa_id: 9 },
        { nombre: 'Antonio Díaz', email: 'antonio@example.com', telefono: '601234567', servicio: 'Albañilería general', descripcion: 'Reparar grietas en la pared', prioridad: 'media', estado: 'en_proceso', empresa_id: 10 },
        { nombre: 'Lucía Romero', email: 'lucia@example.com', telefono: '612345679', servicio: 'Carpintería', descripcion: 'Instalar armarios empotrados', prioridad: 'media', estado: 'pendiente', empresa_id: 1 },
        { nombre: 'Javier Muñoz', email: 'javier@example.com', telefono: '623456780', servicio: 'Cristalería', descripcion: 'Cambiar cristal roto de ventana', prioridad: 'alta', estado: 'completado', empresa_id: 2 },
        { nombre: 'Elena Castro', email: 'elena@example.com', telefono: '634567891', servicio: 'Jardinería', descripcion: 'Mantenimiento mensual del jardín', prioridad: 'baja', estado: 'pendiente', empresa_id: 3 },
        { nombre: 'Manuel Ortiz', email: 'manuel@example.com', telefono: '645678902', servicio: 'Limpieza profunda', descripcion: 'Limpieza completa del local', prioridad: 'media', estado: 'en_proceso', empresa_id: 4 },
        { nombre: 'Pilar Rubio', email: 'pilar@example.com', telefono: '656789013', servicio: 'Control de plagas', descripcion: 'Tenemos cucarachas en la cocina', prioridad: 'urgente', estado: 'pendiente', empresa_id: 5 },
    ];

    const insertTicket = db.prepare(`
        INSERT INTO tickets (nombre, email, telefono, servicio, descripcion, prioridad, estado, empresa_id, fecha_creacion, ticket_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);

    const createdTicketIds = [];
    for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const ticketId = `TICK-${Date.now()}-${i}`;
        insertTicket.run(
            ticket.nombre, ticket.email, ticket.telefono, ticket.servicio,
            ticket.descripcion, ticket.prioridad, ticket.estado, ticket.empresa_id, ticketId
        );
        createdTicketIds.push(ticketId);
        console.log(`  ✅ Ticket creado: ${ticketId} - ${ticket.servicio} (${ticket.estado})`);
    }

    // ============================================
    // 6. AÑADIR NOTAS A ALGUNOS TICKETS
    // ============================================
    console.log('\n📝 Añadiendo notas a tickets...');

    const notas = [
        { ticket_id: createdTicketIds[0], nota: 'Cliente contactado, visita programada para mañana', autor: 'admin' },
        { ticket_id: createdTicketIds[0], nota: 'Fuga localizada en tubería del baño', autor: 'tecnico1' },
        { ticket_id: createdTicketIds[1], nota: 'Reparación en curso, se necesitan materiales adicionales', autor: 'tecnico1' },
        { ticket_id: createdTicketIds[4], nota: 'Desatasco completado con éxito', autor: 'tecnico2' },
        { ticket_id: createdTicketIds[7], nota: 'Trabajo finalizado, cliente satisfecho', autor: 'tecnico1' },
    ];

    const insertNota = db.prepare(`
        INSERT INTO notas (ticket_id, nota, autor, fecha_creacion)
        VALUES (?, ?, ?, datetime('now'))
    `);

    for (const nota of notas) {
        insertNota.run(nota.ticket_id, nota.nota, nota.autor);
        console.log(`  ✅ Nota añadida al ticket #${nota.ticket_id}`);
    }

    // ============================================
    // 7. AÑADIR HORAS DE TRABAJO
    // ============================================
    console.log('\n⏱️  Añadiendo horas de trabajo...');

    const horas = [
        { ticket_id: createdTicketIds[1], tecnico: 'Juan Pérez', horas: 3.5, descripcion: 'Reparación de tubería principal', tarifa: 35.00 },
        { ticket_id: createdTicketIds[3], tecnico: 'María García', horas: 2.0, descripcion: 'Mantenimiento preventivo completo', tarifa: 30.00 },
        { ticket_id: createdTicketIds[4], tecnico: 'Juan Pérez', horas: 1.5, descripcion: 'Desatasco de fregadero', tarifa: 35.00 },
        { ticket_id: createdTicketIds[7], tecnico: 'María García', horas: 4.0, descripcion: 'Reparación de instalación eléctrica', tarifa: 40.00 },
        { ticket_id: createdTicketIds[9], tecnico: 'Juan Pérez', horas: 5.0, descripcion: 'Reparación de grietas y enlucido', tarifa: 32.00 },
    ];

    const insertHora = db.prepare(`
        INSERT INTO horas_trabajo (ticket_id, tecnico, horas, descripcion, fecha)
        VALUES (?, ?, ?, ?, datetime('now'))
    `);

    for (const hora of horas) {
        insertHora.run(hora.ticket_id, hora.tecnico, hora.horas, hora.descripcion);
        console.log(`  ✅ Horas añadidas: ${hora.horas}h por ${hora.tecnico} en ticket ${hora.ticket_id}`);
    }

    console.log('\n✅ ¡Datos de prueba creados exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   - ${usuarios.length} usuarios`);
    console.log(`   - ${empresas.length} empresas`);
    console.log(`   - ${servicios.length} servicios`);
    console.log(`   - ${materiales.length} materiales`);
    console.log(`   - ${tickets.length} tickets`);
    console.log(`   - ${notas.length} notas`);
    console.log(`   - ${horas.length} registros de horas`);
    console.log('\n🚀 La base de datos está lista para pruebas!\n');

} catch (error) {
    console.error('\n❌ Error al crear datos de prueba:', error.message);
    console.error(error.stack);
    process.exit(1);
} finally {
    db.close();
}
