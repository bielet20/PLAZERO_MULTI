const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function setup() {
    console.log('🚀 Iniciando configuración de la aplicación...');

    // 1. Crear directorios necesarios
    const dirs = ['backups', 'data', 'logs', '.wwebjs_auth'];
    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            console.log(`📁 Creando directorio: ${dir}`);
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });

    // 2. Setup .env
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');

    if (!fs.existsSync(envPath)) {
        console.log('📝 Creando archivo .env desde .env.example...');
        if (fs.existsSync(envExamplePath)) {
            let envContent = fs.readFileSync(envExamplePath, 'utf8');

            // Generar un SESSION_SECRET aleatorio si está vacío
            const secret = crypto.randomBytes(32).toString('hex');
            if (envContent.includes('SESSION_SECRET=')) {
                envContent = envContent.replace(/SESSION_SECRET=\s*$/m, `SESSION_SECRET=${secret}`);
                // Si no hay salto de línea arriba o es el final del archivo
                if (envContent === fs.readFileSync(envExamplePath, 'utf8')) {
                    envContent = envContent.replace('SESSION_SECRET=', `SESSION_SECRET=${secret}`);
                }
            }

            fs.writeFileSync(envPath, envContent);
            console.log('✅ Archivo .env creado con éxito.');
        } else {
            console.error('❌ Error: .env.example no encontrado.');
            process.exit(1);
        }
    } else {
        console.log('ℹ️  El archivo .env ya existe.');
    }

    console.log('\n✨ Configuración completada.');
    console.log('👉 Puedes iniciar la aplicación con: npm start');
}

setup().catch(err => {
    console.error('❌ Error durante la configuración:', err);
    process.exit(1);
});
