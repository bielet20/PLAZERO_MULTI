const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const cleanDb = (dbPath) => {
    if (!fs.existsSync(dbPath)) {
        console.log(`ℹ️  Base de datos no existe: ${dbPath}`);
        return;
    }

    console.log(`🧹 Limpiando base de datos: ${dbPath}...`);
    try {
        const db = new Database(dbPath);

        // Get all tables
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

        db.exec('PRAGMA foreign_keys = OFF;');
        for (const table of tables) {
            console.log(`   - Eliminando tabla: ${table.name}`);
            db.exec(`DROP TABLE IF EXISTS "${table.name}"`);
        }
        db.exec('PRAGMA foreign_keys = ON;');
        db.exec('VACUUM;');
        db.close();
        console.log(`✅ Base de datos ${dbPath} limpia.\n`);
    } catch (err) {
        console.error(`❌ Error limpiando ${dbPath}:`, err.message);
    }
};

const main = () => {
    const rootDb = path.join(__dirname, 'tickets.db');
    const dataDb = path.join(__dirname, 'data', 'tickets.db');

    cleanDb(rootDb);
    cleanDb(dataDb);

    console.log('🚀 Sistema listo para una nueva instalación.');
};

main();
