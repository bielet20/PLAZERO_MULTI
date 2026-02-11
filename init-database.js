#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.tmpdir(), 'plazero-tickets.db');

console.log('🔧 Inicializando base de datos en /tmp...');
console.log(`📄 Ruta: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
    if (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }

    console.log('✅ Base de datos creada\n');

    db.run(`
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
    `, async (err) => {
        if (err) {
            console.error('❌ Error:', err.message);
            db.close();
            process.exit(1);
        }

        console.log('✅ Tabla usuarios creada\n');

        const username = 'admin';
        const password = process.env.ADMIN_SETUP_PASSWORD || 'admin123';
        if (!process.env.ADMIN_SETUP_PASSWORD) {
            console.warn('⚠️  Usando contraseña por defecto "admin123". Define ADMIN_SETUP_PASSWORD en .env para mayor seguridad.');
        }
        const passwordHash = await bcrypt.hash(password, 10);

        db.run(
            'INSERT OR REPLACE INTO usuarios (username, password_hash, nombre_completo, email, rol) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, 'Administrador', 'admin@local', 'admin'],
            (err) => {
                if (err) {
                    console.error('❌ Error:', err.message);
                } else {
                    console.log('═'.repeat(60));
                    console.log('🎉 ¡BASE DE DATOS LISTA!');
                    console.log('═'.repeat(60));
                    console.log('\n🔑 Credenciales:');
                    console.log(`   Usuario:     ${username}`);
                    console.log(`   Contraseña:  ${password}`);
                    console.log('\n📍 http://localhost:3000/admin');
                    console.log('\n✅ Inicia: npm start\n');
                    console.log('═'.repeat(60));
                }

                db.close();
                process.exit(err ? 1 : 0);
            }
        );
    });
});
