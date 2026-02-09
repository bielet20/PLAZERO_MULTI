const Database = require('better-sqlite3');
const db = new Database('tickets.db'); // Assuming it's not actually in memory for this check or I'll try to check if there is a file

try {
    const citations = db.prepare('SELECT * FROM citas LIMIT 5').all();
    console.log('CITAS:', JSON.stringify(citations, null, 2));

    const tickets = db.prepare('SELECT * FROM tickets LIMIT 5').all();
    console.log('TICKETS:', JSON.stringify(tickets, null, 2));
} catch (e) {
    console.error('Error:', e.message);
}
