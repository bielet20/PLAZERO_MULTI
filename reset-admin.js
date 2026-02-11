#!/usr/bin/env node

/**
 * Script para resetear las credenciales de administrador
 * Crea o actualiza el usuario admin con credenciales conocidas
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'tickets.db');

console.log('🔐 Reseteando credenciales de administrador...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al abrir la base de datos:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado a la base de datos\n');
});

// Credenciales a establecer
const username = 'admin';
const password = process.env.ADMIN_SETUP_PASSWORD || 'admin123';
if (!process.env.ADMIN_SETUP_PASSWORD) {
    console.warn('⚠️  Usando contraseña por defecto "admin123". Define ADMIN_SETUP_PASSWORD en .env para mayor seguridad.');
}
const nombreCompleto = 'Administrador';
const email = 'admin@local';
const rol = 'admin';

async function resetAdmin() {
    try {
        // Hash de la contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        // Verificar si el usuario existe
        db.get('SELECT id FROM usuarios WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error('❌ Error al buscar usuario:', err.message);
                db.close();
                process.exit(1);
            }

            if (row) {
                // Usuario existe, actualizar
                console.log(`📝 Usuario '${username}' encontrado, actualizando...`);
                db.run(
                    'UPDATE usuarios SET password_hash = ?, activo = 1, rol = ? WHERE username = ?',
                    [passwordHash, rol, username],
                    (err) => {
                        if (err) {
                            console.error('❌ Error al actualizar:', err.message);
                            db.close();
                            process.exit(1);
                        }
                        console.log('✅ Credenciales actualizadas exitosamente\n');
                        showCredentials();
                    }
                );
            } else {
                // Usuario no existe, crear
                console.log(`📝 Usuario '${username}' no encontrado, creando...`);
                db.run(
                    'INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol, activo) VALUES (?, ?, ?, ?, ?, 1)',
                    [username, passwordHash, nombreCompleto, email, rol],
                    (err) => {
                        if (err) {
                            console.error('❌ Error al crear:', err.message);
                            db.close();
                            process.exit(1);
                        }
                        console.log('✅ Usuario creado exitosamente\n');
                        showCredentials();
                    }
                );
            }
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        db.close();
        process.exit(1);
    }
}

function showCredentials() {
    console.log('═'.repeat(50));
    console.log('🔑 CREDENCIALES DE ACCESO');
    console.log('═'.repeat(50));
    console.log(`Usuario:     ${username}`);
    console.log(`Contraseña:  ${password}`);
    console.log('═'.repeat(50));
    console.log('\n✅ Ahora puedes iniciar sesión en http://localhost:3000/admin\n');

    db.close((err) => {
        if (err) {
            console.error('Error al cerrar la base de datos:', err.message);
        }
        process.exit(0);
    });
}

resetAdmin();
