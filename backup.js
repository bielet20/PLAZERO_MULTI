#!/usr/bin/env node

/**
 * Script de Backup Automático
 * Realiza copias de seguridad de:
 * - Base de datos SQLite
 * - Archivos de configuración
 * - Archivos públicos
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_FILE = path.join(__dirname, 'data', 'tickets.db');

// Crear directorio de backups si no existe
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('✓ Directorio de backups creado');
}

// Generar nombre del backup con timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupName = `backup_${timestamp}`;
const backupPath = path.join(BACKUP_DIR, backupName);

// Crear directorio del backup
fs.mkdirSync(backupPath, { recursive: true });

console.log(`\n${'='.repeat(50)}`);
console.log('📦 Iniciando copia de seguridad');
console.log(`${'='.repeat(50)}\n`);

try {
    // 1. Backup de la base de datos
    console.log('1️⃣  Copiando base de datos...');
    if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, path.join(backupPath, 'tickets.db'));
        console.log('   ✓ Base de datos: tickets.db');
    } else {
        console.log('   ⚠️  Base de datos no encontrada');
    }

    // 2. Backup de archivos de configuración
    console.log('\n2️⃣  Copiando configuración...');
    const configFiles = ['.env', '.env.example', 'package.json', 'Dockerfile', 'docker-compose.yml'];
    configFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, path.join(backupPath, file));
            console.log(`   ✓ ${file}`);
        }
    });

    // 3. Backup de archivos públicos (HTML, CSS, JS)
    console.log('\n3️⃣  Copiando archivos públicos...');
    const publicDir = path.join(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
        const publicBackup = path.join(backupPath, 'public');
        execSync(`cp -r "${publicDir}" "${publicBackup}"`);
        console.log('   ✓ Directorio public/');
    }

    // 4. Backup del código fuente principal
    console.log('\n4️⃣  Copiando código fuente...');
    const sourceFiles = ['server.js', 'database.js', 'email.js', 'whatsapp.js', 'backup.js', 'restore.js'];
    sourceFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, path.join(backupPath, file));
            console.log(`   ✓ ${file}`);
        }
    });

    // 4.5 Backup de sesiones de WhatsApp
    console.log('\n4️⃣.5️⃣  Copiando sesiones de WhatsApp...');
    const whatsappDirs = ['.wwebjs_auth', '.wwebjs_cache'];
    whatsappDirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (fs.existsSync(dirPath)) {
            const destPath = path.join(backupPath, dir);
            // Usamos rsync para excluir archivos de bloqueo y sockets que dan error al copiar
            try {
                execSync(`rsync -a --exclude="Singleton*" --exclude="RunningChromeVersion" "${dirPath}/" "${destPath}/"`);
                console.log(`   ✓ ${dir}/`);
            } catch (e) {
                console.log(`   ⚠️  ${dir}/ (copiado con advertencias)`);
            }
        }
    });

    // 5. Crear archivo de información del backup
    console.log('\n5️⃣  Creando archivo de información...');
    const backupInfo = {
        fecha: new Date().toISOString(),
        timestamp: timestamp,
        version: require('./package.json').version,
        archivos: fs.readdirSync(backupPath),
        tamaño: getDirectorySize(backupPath)
    };
    fs.writeFileSync(
        path.join(backupPath, 'backup_info.json'),
        JSON.stringify(backupInfo, null, 2)
    );
    console.log('   ✓ backup_info.json');

    // 6. Crear comprimido
    console.log('\n6️⃣  Comprimiendo backup...');
    const zipName = `${backupName}.tar.gz`;
    const zipPath = path.join(BACKUP_DIR, zipName);
    execSync(`cd "${BACKUP_DIR}" && tar -czf "${zipName}" "${backupName}"/`);
    console.log(`   ✓ ${zipName}`);

    // Información final
    const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);

    console.log(`\n${'='.repeat(50)}`);
    console.log('✅ Backup completado exitosamente');
    console.log(`${'='.repeat(50)}\n`);
    console.log(`📂 Ubicación: ${BACKUP_DIR}`);
    console.log(`📦 Archivo: ${zipName}`);
    console.log(`💾 Tamaño: ${zipSize} MB`);
    console.log(`🕐 Fecha: ${backupInfo.fecha}\n`);

    // Limpiar directorio descomprimido
    execSync(`rm -rf "${backupPath}"`);

} catch (error) {
    console.error('\n❌ Error durante el backup:');
    console.error(error.message);
    // Limpieza en caso de error
    if (typeof backupPath !== 'undefined' && fs.existsSync(backupPath)) {
        execSync(`rm -rf "${backupPath}"`);
    }
    process.exit(1);
}

/**
 * Calcula el tamaño total de un directorio
 */
function getDirectorySize(dirPath) {
    let size = 0;
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            size += getDirectorySize(filePath);
        } else {
            size += stats.size;
        }
    });

    return size;
}
