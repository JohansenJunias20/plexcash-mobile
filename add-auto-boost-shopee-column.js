/**
 * Add auto_boost_shopee column to all tenant databases
 *
 * This script adds the auto_boost_shopee column to import_barang and varian_importbarang tables
 * in all tenant databases to enable automated Shopee product boosting functionality.
 *
 * Usage: node add-auto-boost-shopee-column.js
 */

const { pool } = require('./Server/Connection');
const util = require('util');

async function addAutoBoostShopeeColumn() {
    let connection;

    try {
        console.log('🔌 Getting connection from pool...');
        connection = await new Promise((resolve, reject) => {
            pool.getConnection((err, conn) => {
                if (err) reject(err);
                else resolve(conn);
            });
        });

        // Promisify query function
        const query = util.promisify(connection.query).bind(connection);

        console.log('✅ Connected to MySQL successfully\n');

        // Get all tenant databases from user_mapping.roles
        console.log('📋 Fetching all tenant databases...');
        const databases = await query(`
            SELECT DISTINCT database_name
            FROM user_mapping.roles
            WHERE database_name IS NOT NULL
            AND database_name != ''
            ORDER BY database_name
        `);

        console.log(`Found ${databases.length} tenant databases\n`);

        if (databases.length === 0) {
            console.log('⚠️  No tenant databases found. Exiting.');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const db of databases) {
            const dbName = db.database_name;

            try {
                console.log(`📦 Processing database: ${dbName}`);

                // Use the database
                await query(`USE \`${dbName}\``);

                // Check if column already exists in import_barang
                const importBarangColumns = await query(`
                    SELECT COLUMN_NAME
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = 'import_barang'
                    AND COLUMN_NAME = 'auto_boost_shopee'
                `, [dbName]);

                if (importBarangColumns.length > 0) {
                    console.log(`   ℹ️  Column 'auto_boost_shopee' already exists in import_barang`);
                } else {
                    // Add column to import_barang
                    await query(`
                        ALTER TABLE import_barang 
                        ADD COLUMN auto_boost_shopee TINYINT(1) DEFAULT 0 
                        COMMENT 'Enable automatic Shopee product boosting (4-hour cooldown)'
                    `);
                    console.log(`   ✅ Added 'auto_boost_shopee' column to import_barang`);

                    // Add index
                    await query(`CREATE INDEX idx_auto_boost_shopee ON import_barang(auto_boost_shopee)`);
                    console.log(`   ✅ Created index idx_auto_boost_shopee on import_barang`);
                }

                // Check if column already exists in varian_importbarang
                const varianColumns = await query(`
                    SELECT COLUMN_NAME
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = 'varian_importbarang'
                    AND COLUMN_NAME = 'auto_boost_shopee'
                `, [dbName]);

                if (varianColumns.length > 0) {
                    console.log(`   ℹ️  Column 'auto_boost_shopee' already exists in varian_importbarang`);
                } else {
                    // Add column to varian_importbarang
                    await query(`
                        ALTER TABLE varian_importbarang 
                        ADD COLUMN auto_boost_shopee TINYINT(1) DEFAULT 0 
                        COMMENT 'Enable automatic Shopee product boosting (4-hour cooldown)'
                    `);
                    console.log(`   ✅ Added 'auto_boost_shopee' column to varian_importbarang`);

                    // Add index
                    await query(`CREATE INDEX idx_auto_boost_shopee_varian ON varian_importbarang(auto_boost_shopee)`);
                    console.log(`   ✅ Created index idx_auto_boost_shopee_varian on varian_importbarang`);
                }

                successCount++;

            } catch (error) {
                errorCount++;
                const errorMsg = `Error in database ${dbName}: ${error.message}`;
                errors.push(errorMsg);
                console.error(`   ❌ ${errorMsg}`);
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total databases: ${databases.length}`);
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        
        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(err => console.log(`   - ${err}`));
        }
        
        console.log('\n🎉 Script completed!');
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            connection.release();
            console.log('\n🔌 Connection released');
        }
        await pool.end();
        console.log('🔌 Pool closed');
    }
}

// Run the script
addAutoBoostShopeeColumn().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

