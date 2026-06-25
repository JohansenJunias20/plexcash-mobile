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
        const start = '2026-06-01 00:00:00';
        const end = '2026-06-30 23:59:59';
        
        const sql = ` SELECT A.id, ANY_VALUE(A.id_penjualan) id_penjualan, ANY_VALUE(A.reason) reason, ANY_VALUE(A.tanggal) tanggal, ANY_VALUE(A.approved) approved, ANY_VALUE(COALESCE(A.id_retur, A.id)) id_retur, ANY_VALUE(E.platform) platform, ANY_VALUE(E.name) shop_name, ANY_VALUE(A.id_ecommerce) id_ecommerce, sum(if(b.qty=0,c.qty,b.qty)*c.harga_jual) total, ANY_VALUE(A.id_online) id_online, ANY_VALUE(A.invoice_tokped) invoice_tokped, ANY_VALUE(A.nomor_resi) nomor_resi,
        ANY_VALUE(po.print) as print, ANY_VALUE(po.print_timestamp) as print_timestamp, ANY_VALUE(s.time_scan) as scanout_time, ANY_VALUE(p.time_pack) as pack_time
        FROM RETURONLINE A
        JOIN DETAILRETURONLINE B
        ON A.ID = B.ID_RO
        LEFT JOIN MASTERBARANG D
        ON B.ID_MASTERBARANG = D.ID
        JOIN DETAILPENJUALAN C
        ON C.ID_BARANG = D.ID  AND C.ID_PENJUALAN = CAST(A.ID_PENJUALAN AS UNSIGNED)
        JOIN ECOMMERCE E
        ON A.ID_ECOMMERCE = E.ID
        LEFT JOIN penjualan_online po ON A.id_online = po.id_online
        LEFT JOIN scanout s ON (po.no_resi = s.resi OR po.id_online = s.resi)
        LEFT JOIN pack p ON (po.no_resi = p.resi OR po.id_online = p.resi)
        WHERE A.TANGGAL <= ? AND A.TANGGAL >= ?
        GROUP BY A.id`;

        const [result] = await connection.query(sql, [end, start]);
        console.log('Result length:', result.length);
        const target = result.find(r => r.id_online === '260605AQXVREPM');
        console.log('Target row:', JSON.stringify(target, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

main().catch(console.error);
