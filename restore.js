#!/usr/bin/env node

/**
 * Script de Restauración de Backup
 * Restaura todos los datos desde un backup anterior
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.join(__dirname, 'backups');

console.log(`\n${'='.repeat(50)}`);
console.log('🔄 Herramienta de Restauración de Backup');
console.log(`${'='.repeat(50)}\n`);

// Listar backups disponibles
const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.tar.gz'))
    .sort()
    .reverse();

if (backups.length === 0) {
    console.error('❌ No hay backups disponibles en', BACKUP_DIR);
    process.exit(1);
}

console.log('📦 Backups disponibles:\n');
backups.forEach((backup, i) => {
    const filePath = path.join(BACKUP_DIR, backup);
    const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
    const stats = fs.statSync(filePath);
    const date = stats.mtime.toLocaleString();
    console.log(`${i + 1}. ${backup}`);
    console.log(`   Tamaño: ${size} MB`);
    console.log(`   Fecha: ${date}\n`);
});

// Usar el backup más reciente
const backupFile = backups[0];
const backupPath = path.join(BACKUP_DIR, backupFile);
const extractDir = path.join(BACKUP_DIR, backupFile.replace('.tar.gz', ''));

console.log(`Selected: ${backupFile}`);
console.log(`\n${'='.repeat(50)}`);
console.log('⚠️  IMPORTANTE:');
console.log(`${'='.repeat(50)}`);
console.log('Esta operación reemplazará los datos actuales.');
console.log('Se recomienda hacer un backup actual primero.\n');

// En un script real, aquí habría confirmación del usuario
console.log('📥 Extrayendo backup...');
try {
    execSync(`cd "${BACKUP_DIR}" && tar -xzf "${backupFile}"`);
    console.log('✓ Extracción completada');

    console.log('\n📂 Restaurando archivos...');

    // Restaurar base de datos
    const dbFile = path.join(extractDir, 'tickets.db');
    if (fs.existsSync(dbFile)) {
        const targetDb = path.join(__dirname, 'data', 'tickets.db');
        if (!fs.existsSync(path.dirname(targetDb))) fs.mkdirSync(path.dirname(targetDb), { recursive: true });
        fs.copyFileSync(dbFile, targetDb);
        console.log('✓ Base de datos restaurada en data/tickets.db');
    }

    // Restaurar sesiones de WhatsApp
    const whatsappDirs = ['.wwebjs_auth', '.wwebjs_cache'];
    whatsappDirs.forEach(dir => {
        const dirPath = path.join(extractDir, dir);
        if (fs.existsSync(dirPath)) {
            execSync(`rm -rf "${path.join(__dirname, dir)}" && cp -r "${dirPath}" "${path.join(__dirname, dir)}"`);
            console.log(`✓ Sesión de WhatsApp (${dir}) restaurada`);
        }
    });

    // Restaurar .env
    const envFile = path.join(extractDir, '.env');
    if (fs.existsSync(envFile)) {
        fs.copyFileSync(envFile, path.join(__dirname, '.env'));
        console.log('✓ Archivo .env restaurado');
    }

    // Restaurar archivos públicos
    const publicDir = path.join(extractDir, 'public');
    if (fs.existsSync(publicDir)) {
        execSync(`rm -rf "${path.join(__dirname, 'public')}" && cp -r "${publicDir}" "${path.join(__dirname, 'public')}"`);
        console.log('✓ Archivos públicos restaurados');
    }

    // Limpiar extracción
    execSync(`rm -rf "${extractDir}"`);

    console.log(`\n✅ Restauración completada exitosamente\n`);

} catch (error) {
    console.error('\n❌ Error durante la restauración:');
    console.error(error.message);
    process.exit(1);
}
