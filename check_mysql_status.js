const mysql = require('mysql2/promise');

async function main() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: 'mantab99'
    });

    try {
        console.log('Connected to MySQL successfully!');
        
        // Check show processlist
        const [processes] = await connection.query('SHOW PROCESSLIST');
        console.log('\n--- Show Processlist ---');
        console.log(processes.slice(0, 10));

        // Check if there are tables with errors or crashed in lumiereluxeid@gmail.com
        await connection.query('USE `lumiereluxeid@gmail.com`');
        const [tables] = await connection.query('SHOW TABLES');
        console.log('\n--- Checking tables ---');
        console.log(`Found ${tables.length} tables`);

        // Check returonline
        const [status] = await connection.query('CHECK TABLE returonline, detailreturonline, penjualan_online');
        console.log('\n--- Table Checks ---');
        console.log(status);

    } catch (error) {
        console.error('MySQL Error:', error);
    } finally {
        await connection.end();
    }
}

main().catch(console.error);
