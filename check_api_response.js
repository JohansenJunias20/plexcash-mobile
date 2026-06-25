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
        
        // Simulating the fallback marketplace API return
        const result_pg = [{
            id: '260605AQXVREPM',
            date: '2026-06-05 14:35:35',
            id_ecommerce: 12
        }];

        const idOnlines = result_pg.map(ro => ro.id);
        const [poRows] = await connection.query(
            `SELECT po.id_online, po.print, po.print_timestamp,
                    s.time_scan as scanout_time,
                    p.time_pack as pack_time
             FROM penjualan_online po
             LEFT JOIN scanout s ON (po.no_resi = s.resi OR po.id_online = s.resi)
             LEFT JOIN pack p ON (po.no_resi = p.resi OR po.id_online = p.resi)
             WHERE po.id_online IN (?)`,
            [idOnlines]
        );

        console.log('poRows output:', JSON.stringify(poRows, null, 2));

        const [result_db] = await connection.query("select * from returonline where id_online in (?)", [idOnlines]);
        const [result_db2] = await connection.query("select id,online_id,total from penjualan where online_id in (?)", [idOnlines]);

        const poMap = new Map();
        poRows.forEach(row => {
            poMap.set(row.id_online, row);
        });

        const final = result_pg.map(ro => {
            const found = result_db.find(rd => rd.id_online == ro.id);
            const penjualan = result_db2.find(rdb2 => rdb2.online_id == ro.id);
            const info = poMap.get(ro.id) || {};
            const base = {
                print: info.print ? true : false,
                print_timestamp: info.print_timestamp || null,
                scanout: info.scanout_time ? true : false,
                scanout_time: info.scanout_time || null,
                pack: info.pack_time ? true : false,
                pack_time: info.pack_time || null
            };
            if (found) {
                return {
                    id: ro.id,
                    status: found.approved ? 'approved' : 'rejected',
                    id_online: ro.id,
                    id_retur: found.id_retur || found.id,
                    tanggal: ro.date,
                    id_ecommerce: ro.id_ecommerce,
                    id_penjualan: penjualan?.id || null,
                    total: penjualan?.total || null,
                    ...base
                };
            }
            return {
                id: ro.id,
                status: 'pending',
                id_online: ro.id,
                id_retur: null,
                tanggal: ro.date,
                id_ecommerce: ro.id_ecommerce,
                id_penjualan: penjualan?.id || null,
                total: penjualan?.total || null,
                ...base
            };
        });

        console.log('Final output object:', JSON.stringify(final, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

main().catch(console.error);
