const fs = require('fs');
const path = require('path');

console.log('🔄 Iniciando reset de base de datos...\n');

const dbPath = path.join(__dirname, 'tickets.db');
const dbShmPath = path.join(__dirname, 'tickets.db-shm');
const dbWalPath = path.join(__dirname, 'tickets.db-wal');

// Create backup with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `tickets.db.backup-${timestamp}`);

try {
    // Step 1: Backup existing database if it exists
    if (fs.existsSync(dbPath)) {
        console.log('📦 Creando backup de la base de datos actual...');
        fs.copyFileSync(dbPath, backupPath);
        console.log(`✅ Backup creado: ${backupPath}\n`);
    } else {
        console.log('ℹ️  No existe base de datos actual, no se necesita backup\n');
    }

    // Step 2: Delete current database files
    console.log('🗑️  Eliminando archivos de base de datos...');

    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('✅ Eliminado: tickets.db');
    }

    if (fs.existsSync(dbShmPath)) {
        fs.unlinkSync(dbShmPath);
        console.log('✅ Eliminado: tickets.db-shm');
    }

    if (fs.existsSync(dbWalPath)) {
        fs.unlinkSync(dbWalPath);
        console.log('✅ Eliminado: tickets.db-wal');
    }

    console.log('\n✅ Base de datos reseteada exitosamente!');
    console.log('📝 Ahora puedes iniciar el servidor para crear una base de datos fresca.\n');

} catch (error) {
    console.error('❌ Error al resetear la base de datos:', error.message);
    process.exit(1);
}
