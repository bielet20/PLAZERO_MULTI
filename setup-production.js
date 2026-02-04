const bcryptjs = require('bcryptjs');
const { db, getAllUsers, getUserByUsername, updateUser, createUser } = require('./database');

async function setupProduction() {
    try {
        console.log('🔒 Iniciando configuración de producción...\n');

        // Leer credenciales de variables de entorno
        const adminPassword = process.env.ADMIN_SETUP_PASSWORD;
        const rootPassword = process.env.ROOT_SETUP_PASSWORD;

        if (!adminPassword || !rootPassword) {
            console.error('❌ ERROR: ADMIN_SETUP_PASSWORD y ROOT_SETUP_PASSWORD deben estar definidos en .env');
            console.error('   Agregue estas líneas a su archivo .env:');
            console.error('   ADMIN_SETUP_PASSWORD=su_contraseña_segura_aqui');
            console.error('   ROOT_SETUP_PASSWORD=otra_contraseña_segura_aqui');
            process.exit(1);
        }

        // 1. Cambiar contraseña del admin
        console.log('1️⃣ Actualizando contraseña del usuario admin...');
        const adminHash = await bcryptjs.hash(adminPassword, 10);

        const adminUser = await getUserByUsername('admin');
        if (adminUser) {
            await updateUser(adminUser.id, { password_hash: adminHash });
            console.log('   ✅ Contraseña del admin actualizada');
        } else {
            console.log('   ⚠️ Usuario admin no encontrado');
        }

        // 2. Crear usuario Root
        console.log('\n2️⃣ Creando usuario Root...');
        const rootHash = await bcryptjs.hash(rootPassword, 10);

        const existingRoot = await getUserByUsername('Root');
        if (existingRoot) {
            console.log('   ⚠️ Usuario Root ya existe. Actualizando contraseña...');
            await updateUser(existingRoot.id, { password_hash: rootHash });
            console.log('   ✅ Contraseña del usuario Root actualizada');
        } else {
            const newRoot = await createUser(
                'Root',
                rootHash,
                'Root Administrator',
                'root@admin.local',
                'admin'
            );
            console.log('   ✅ Usuario Root creado exitosamente');
            console.log(`   ID: ${newRoot.id}`);
        }

        console.log('\n🔐 Configuración de producción completada');
        console.log('   ⚠️ IMPORTANTE: Elimine ADMIN_SETUP_PASSWORD y ROOT_SETUP_PASSWORD del .env después de ejecutar este script');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante la configuración:', error);
        process.exit(1);
    }
}

setupProduction();
