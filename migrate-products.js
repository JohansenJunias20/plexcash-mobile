/**
 * Product Migration Script
 * Reads Excel file and generates SQL INSERT statements for:
 * - masterbarang (main products)
 * - bundling (bundle definitions)
 * - detailbundling (bundle item details)
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const EXCEL_FILE = 'Produk Material-2026-01-09__2026-01-09.xlsx';
const OUTPUT_FILE = 'migration-output.sql';

// Validate file exists
if (!fs.existsSync(EXCEL_FILE)) {
  console.error(`Error: Excel file not found at ${EXCEL_FILE}`);
  process.exit(1);
}

console.log('📖 Reading Excel file...');
const workbook = XLSX.readFile(EXCEL_FILE);
const sheetNames = workbook.SheetNames;
console.log(`Found sheets: ${sheetNames.join(', ')}`);

// Parse data from sheets
const allData = {};
sheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  allData[sheetName] = data;
  console.log(`✓ Sheet "${sheetName}": ${data.length} rows`);
});

// Generate SQL statements
const sqlStatements = [];
const masterBarangMap = new Map();
const bundlingMap = new Map();
let masterBarangId = 1;
let bundlingId = 1;

// First pass: Create all unique products and materials
console.log('\n📝 First pass: Creating unique products...');
const uniqueProducts = new Set();
const uniqueMaterials = new Set();

Object.entries(allData).forEach(([sheetName, rows]) => {
  rows.forEach(row => {
    if (row['product']) uniqueProducts.add(row['product']);
    if (row['material']) uniqueMaterials.add(row['material']);
  });
});

console.log(`Found ${uniqueProducts.size} unique products`);
console.log(`Found ${uniqueMaterials.size} unique materials`);

// Create masterbarang entries
const allUniqueItems = new Set([...uniqueProducts, ...uniqueMaterials]);
allUniqueItems.forEach(itemName => {
  if (itemName && itemName.trim()) {
    const sku = `SKU_${masterBarangId}`;
    const masterBarangSQL = `INSERT INTO masterbarang (nama, merk, satuan, kategori, stok, stok_online, hargajual, hargabeli, sku) VALUES ('${escapeSql(itemName)}', '', 'PCS', '', 0, 0, 0, 0, '${escapeSql(sku)}');`;
    sqlStatements.push(masterBarangSQL);
    masterBarangMap.set(itemName, masterBarangId);
    masterBarangId++;
  }
});

// Second pass: Create bundles and detail bundling
console.log('\n📝 Second pass: Creating bundles...');
Object.entries(allData).forEach(([sheetName, rows]) => {
  rows.forEach((row, index) => {
    try {
      const productName = row['product'];
      const materialName = row['material'];
      const qty = parseInt(row['qty'] || 1);

      if (productName && materialName) {
        // Create bundle for this product
        if (!bundlingMap.has(productName)) {
          const bundleSku = `BUNDLE_${bundlingId}`;
          const bundlingSQL = `INSERT INTO bundling (nama, sku, hargajual, label) VALUES ('${escapeSql(productName)}', '${escapeSql(bundleSku)}', 0, NULL);`;
          sqlStatements.push(bundlingSQL);
          bundlingMap.set(productName, bundlingId);
          bundlingId++;
        }

        // Create detail bundling entry
        const bundleId = bundlingMap.get(productName);
        const materialId = masterBarangMap.get(materialName);

        if (bundleId && materialId) {
          const detailSQL = `INSERT INTO detailbundling (id_bundling, id_masterbarang, qty_required) VALUES (${bundleId}, ${materialId}, ${qty});`;
          sqlStatements.push(detailSQL);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Error processing row ${index + 1}: ${error.message}`);
    }
  });
});

// Write SQL to file
const sqlContent = `-- Product Migration SQL
-- Generated: ${new Date().toISOString()}
-- Total statements: ${sqlStatements.length}

SET FOREIGN_KEY_CHECKS=0;

${sqlStatements.join('\n')}

SET FOREIGN_KEY_CHECKS=1;

-- Migration complete!
`;

fs.writeFileSync(OUTPUT_FILE, sqlContent);
console.log(`\n✅ Migration SQL generated: ${OUTPUT_FILE}`);
console.log(`📊 Total SQL statements: ${sqlStatements.length}`);

// Helper function to escape SQL strings
function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

