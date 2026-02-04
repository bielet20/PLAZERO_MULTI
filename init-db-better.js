#!/usr/bin/env node

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'tickets.db');

console.log('🔧 Inicializando base de datos con better-sqlite3...');
console.log(`📄 Ruta: ${dbPath}\n`);

// Eliminar base de datos existente
if (fs.existsSync(dbPath)) {
    try {
        fs.unlinkSync(dbPath);
        console.log('🗑️  Base de datos anterior eliminada\n');
    } catch (err) {
        console.log('⚠️  Continuando...\n');
    }
}

try {
    const db = new Database(dbPath);
    console.log('✅ Base de datos creada\n');

    // Crear tabla
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
    console.log('✅ Tabla usuarios creada\n');

    // Crear usuario admin
    const username = 'admin';
    const password = 'admin123';
    const passwordHash = bcrypt.hashSync(password, 10);

    const insert = db.prepare('INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol) VALUES (?, ?, ?, ?, ?)');
    insert.run(username, passwordHash, 'Administrador', 'admin@local', 'admin');

    console.log('═'.repeat(60));
    console.log('🎉 ¡BASE DE DATOS LISTA!');
    console.log('═'.repeat(60));
    console.log('\n🔑 Credenciales:');
    console.log(`   Usuario:     ${username}`);
    console.log(`   Contraseña:  ${password}`);
    console.log('\n📍 http://localhost:3000/admin');
    console.log('\n✅ Inicia: npm start\n');
    console.log('═'.repeat(60));

    db.close();

    // Verificar
    const stats = fs.statSync(dbPath);
    console.log(`\n📊 Tamaño: ${stats.size} bytes`);
    console.log(`✅ Base de datos funcional\n`);

} catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
}
