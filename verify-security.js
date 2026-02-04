#!/usr/bin/env node

/**
 * Script de verificación de seguridad
 * Verifica que todas las configuraciones de seguridad estén correctamente implementadas
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔐 Verificación de Seguridad del Sistema\n');
console.log('═'.repeat(60));

let errors = 0;
let warnings = 0;
let passed = 0;

function check(name, condition, errorMsg, isWarning = false) {
    if (condition) {
        console.log(`✅ ${name}`);
        passed++;
    } else {
        if (isWarning) {
            console.log(`⚠️  ${name}: ${errorMsg}`);
            warnings++;
        } else {
            console.log(`❌ ${name}: ${errorMsg}`);
            errors++;
        }
    }
}

console.log('\n📋 Configuración de Entorno\n');

// Verificar NODE_ENV
check(
    'NODE_ENV configurado como production',
    process.env.NODE_ENV === 'production',
    'NODE_ENV debe ser "production" en producción'
);

// Verificar SESSION_SECRET
check(
    'SESSION_SECRET configurado',
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32,
    'SESSION_SECRET debe tener al menos 32 caracteres'
);

// Verificar que no sea el secreto por defecto
check(
    'SESSION_SECRET no es el valor por defecto',
    process.env.SESSION_SECRET !== 'mi_secreto_temporal',
    'Debe cambiar SESSION_SECRET del valor por defecto',
    true
);

console.log('\n📁 Archivos y Directorios\n');

// Verificar que existan los archivos de seguridad
check(
    'logger.js existe',
    fs.existsSync(path.join(__dirname, 'logger.js')),
    'Archivo logger.js no encontrado'
);

check(
    'security-utils.js existe',
    fs.existsSync(path.join(__dirname, 'security-utils.js')),
    'Archivo security-utils.js no encontrado'
);

// Verificar directorio de logs
check(
    'Directorio logs/ existe',
    fs.existsSync(path.join(__dirname, 'logs')),
    'Directorio logs/ no encontrado (se creará automáticamente)',
    true
);

// Verificar .gitignore
const gitignorePath = path.join(__dirname, '.gitignore');
if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    check(
        '.gitignore incluye logs/',
        gitignoreContent.includes('logs/') || gitignoreContent.includes('*.log'),
        'Agregar logs/ a .gitignore',
        true
    );
    check(
        '.gitignore incluye .env',
        gitignoreContent.includes('.env'),
        'Agregar .env a .gitignore'
    );
}

console.log('\n📦 Dependencias\n');

// Verificar package.json
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = packageJson.dependencies || {};

    check(
        'express-rate-limit instalado',
        'express-rate-limit' in deps,
        'Ejecutar: npm install express-rate-limit'
    );

    check(
        'helmet instalado',
        'helmet' in deps,
        'Ejecutar: npm install helmet'
    );

    check(
        'validator instalado',
        'validator' in deps,
        'Ejecutar: npm install validator'
    );

    check(
        'winston instalado',
        'winston' in deps,
        'Ejecutar: npm install winston'
    );

    check(
        'bcryptjs instalado',
        'bcryptjs' in deps,
        'Ejecutar: npm install bcryptjs'
    );
}

console.log('\n🔒 Credenciales\n');

// Verificar credenciales de administrador
check(
    'ADMIN_USERNAME configurado',
    process.env.ADMIN_USERNAME && process.env.ADMIN_USERNAME.length > 0,
    'Configurar ADMIN_USERNAME en .env',
    true
);

check(
    'ADMIN_PASSWORD configurado',
    process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 12,
    'ADMIN_PASSWORD debe tener al menos 12 caracteres',
    true
);

// Advertir sobre credenciales de setup temporal
if (process.env.ADMIN_SETUP_PASSWORD || process.env.ROOT_SETUP_PASSWORD) {
    console.log('⚠️  Credenciales de setup temporal detectadas');
    console.log('   Eliminar ADMIN_SETUP_PASSWORD y ROOT_SETUP_PASSWORD del .env después del setup');
    warnings++;
}

console.log('\n' + '═'.repeat(60));
console.log('\n📊 Resumen de Verificación\n');

console.log(`✅ Verificaciones pasadas: ${passed}`);
if (warnings > 0) {
    console.log(`⚠️  Advertencias: ${warnings}`);
}
if (errors > 0) {
    console.log(`❌ Errores críticos: ${errors}`);
}

console.log('\n' + '═'.repeat(60));

if (errors === 0 && warnings === 0) {
    console.log('\n✅ ¡Configuración de seguridad correcta!');
    console.log('   El sistema está listo para producción.\n');
    process.exit(0);
} else if (errors === 0) {
    console.log('\n⚠️  Configuración aceptable con advertencias');
    console.log('   Revise las advertencias antes de desplegar en producción.\n');
    process.exit(0);
} else {
    console.log('\n❌ Errores críticos encontrados');
    console.log('   Corrija los errores antes de desplegar en producción.\n');
    process.exit(1);
}
