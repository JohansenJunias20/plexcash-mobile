const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mantab99',
    database: 'albertnathaniel2_gmail_com'
  });
  const [rows] = await conn.query("SELECT akses FROM user WHERE email = 'nafiadiansyah04@gmail.com'");
  console.log(JSON.stringify(rows[0].akses, null, 2));
  conn.end();
}
run().catch(console.error);
