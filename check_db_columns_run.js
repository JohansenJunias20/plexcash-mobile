const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: 'mantab99',
        database: 'lumiereluxeid@gmail.com'
    });

    try {
        const [poCols] = await connection.query('DESCRIBE penjualan_online');
        console.log('penjualan_online columns:', poCols.map(c => c.Field));

        const [roCols] = await connection.query('DESCRIBE returonline');
        console.log('returonline columns:', roCols.map(c => c.Field));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

main().catch(console.error);
