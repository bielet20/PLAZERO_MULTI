const Database = require('better-sqlite3');
const db = new Database('tickets.db');

console.log('🧹 Iniciando limpieza de empresas duplicadas...\n');

try {
    // 1. Encontrar nombres duplicados
    const duplicates = db.prepare(`
        SELECT nombre, COUNT(*) as count 
        FROM empresas 
        GROUP BY nombre 
        HAVING count > 1
    `).all();

    console.log(`🔍 Encontradas ${duplicates.length} empresas con duplicados.`);

    db.transaction(() => {
        for (const dup of duplicates) {
            console.log(`\n🏢 Procesando: "${dup.nombre}" (${dup.count} registros)`);

            // Obtener todos los IDs para este nombre, ordenados por ID (el menor será el canónico)
            const records = db.prepare('SELECT id FROM empresas WHERE nombre = ? ORDER BY id ASC').all(dup.nombre);
            const canonicalId = records[0].id;
            const duplicateIds = records.slice(1).map(r => r.id);

            console.log(`  ✅ ID Canónico: ${canonicalId}`);
            console.log(`  🗑️  IDs a eliminar: ${duplicateIds.join(', ')}`);

            // 2. Actualizar tickets
            const updateTickets = db.prepare('UPDATE tickets SET empresa_id = ? WHERE empresa_id = ?');
            let ticketsUpdated = 0;
            for (const oldId of duplicateIds) {
                const info = updateTickets.run(canonicalId, oldId);
                ticketsUpdated += info.changes;
            }
            if (ticketsUpdated > 0) console.log(`  🎫 Tickets actualizados: ${ticketsUpdated}`);

            // 3. Actualizar facturas
            const updateFacturas = db.prepare('UPDATE facturas SET empresa_id = ? WHERE empresa_id = ?');
            let facturasUpdated = 0;
            for (const oldId of duplicateIds) {
                const info = updateFacturas.run(canonicalId, oldId);
                facturasUpdated += info.changes;
            }
            if (facturasUpdated > 0) console.log(`  🧾 Facturas actualizadas: ${facturasUpdated}`);

            // 4. Eliminar duplicados de empresas
            const deleteEmpresa = db.prepare('DELETE FROM empresas WHERE id = ?');
            for (const oldId of duplicateIds) {
                deleteEmpresa.run(oldId);
            }
            console.log(`  ✨ Duplicados eliminados.`);
        }
    })();

    console.log('\n✅ Limpieza completada con éxito.');

} catch (error) {
    console.error('\n❌ Error durante la limpieza:', error.message);
} finally {
    db.close();
}
