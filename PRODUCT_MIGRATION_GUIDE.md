# Product Migration Guide

## Overview
This guide explains how to migrate product data from the user's old POS system to PlexSeller using the generated SQL migration file.

## Files Generated

### 1. `migration-output.sql`
The main SQL file containing all INSERT statements for:
- **masterbarang** (1,754 products): All unique products and materials from the Excel file
- **bundling** (875 bundles): Bundle definitions for composite products
- **detailbundling** (2,316 items): Individual items that make up each bundle

### 2. `migrate_products.py`
The Python script that reads the Excel file and generates the SQL statements.

## Migration Statistics

- **Total Excel Rows**: 2,316
- **Unique Products**: 875
- **Unique Materials**: 879
- **Total Unique Items**: 1,754
- **Total SQL Statements**: 4,925

## Database Schema

The migration uses the following PlexSeller tables:

### masterbarang (Main Products Table)
```sql
CREATE TABLE masterbarang (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255),
  merk VARCHAR(20),
  satuan VARCHAR(50),
  kategori VARCHAR(30),
  stok INT UNSIGNED,
  stok_online INT UNSIGNED,
  hargajual DECIMAL(12,2),
  hargabeli DECIMAL(12,2),
  sku VARCHAR(45),
  ...
);
```

### bundling (Bundle Definitions)
```sql
CREATE TABLE bundling (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(300) UNIQUE,
  sku VARCHAR(45),
  hargajual DECIMAL(13,2),
  label VARCHAR(100)
);
```

### detailbundling (Bundle Item Details)
```sql
CREATE TABLE detailbundling (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_bundling INT,
  id_masterbarang INT,
  qty_required INT,
  FOREIGN KEY (id_masterbarang) REFERENCES masterbarang(id)
);
```

## How to Execute the Migration

### Prerequisites
- MySQL/MariaDB database access
- PlexSeller database already created
- Backup of existing database (recommended)

### Steps

1. **Backup your database** (IMPORTANT):
   ```bash
   mysqldump -u username -p database_name > backup.sql
   ```

2. **Execute the migration SQL**:
   ```bash
   mysql -u username -p database_name < migration-output.sql
   ```

3. **Verify the migration**:
   ```sql
   SELECT COUNT(*) FROM masterbarang;  -- Should show 1,754
   SELECT COUNT(*) FROM bundling;      -- Should show 875
   SELECT COUNT(*) FROM detailbundling; -- Should show 2,316
   ```

## Data Mapping

### From Excel to Database

| Excel Column | Database Field | Notes |
|---|---|---|
| product | bundling.nama | Bundle product name |
| material | masterbarang.nama | Individual material/product |
| qty | detailbundling.qty_required | Quantity required in bundle |

### Default Values

- **merk**: Empty string (can be updated later)
- **kategori**: Empty string (can be updated later)
- **stok**: 0 (update with actual inventory)
- **stok_online**: 0 (update with online inventory)
- **hargajual**: 0 (update with actual selling prices)
- **hargabeli**: 0 (update with actual purchase prices)
- **satuan**: 'PCS' (piece - can be updated per product)
- **sku**: Auto-generated (SKU_1, SKU_2, etc. for products; BUNDLE_1, BUNDLE_2, etc. for bundles)

## Post-Migration Tasks

After executing the migration, you should:

1. **Update Prices**: Set actual selling and purchase prices
2. **Update Stock**: Set current inventory levels
3. **Update Categories**: Assign products to appropriate categories
4. **Update Brands**: Add brand information where applicable
5. **Update Units**: Verify and update units of measure (satuan)
6. **Update Bundle Prices**: Set bundle selling prices (currently 0)

## Troubleshooting

### Foreign Key Constraint Errors
The SQL file includes `SET FOREIGN_KEY_CHECKS=0` at the beginning and `SET FOREIGN_KEY_CHECKS=1` at the end to handle foreign key constraints properly.

### Duplicate Product Names
If you get duplicate key errors on `bundling.nama`, it means the same product appears multiple times in the Excel file. The script handles this by only creating one bundle per unique product name.

### Character Encoding Issues
The SQL file is UTF-8 encoded. Ensure your MySQL connection uses UTF-8:
```sql
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
```

## Rollback

If you need to rollback the migration:

1. **Restore from backup**:
   ```bash
   mysql -u username -p database_name < backup.sql
   ```

2. **Or delete migrated data**:
   ```sql
   DELETE FROM detailbundling WHERE id_bundling > 0;
   DELETE FROM bundling WHERE id > 0;
   DELETE FROM masterbarang WHERE id > 1754;
   ```

## Support

For issues or questions about the migration:
1. Check the migration statistics above
2. Verify the SQL file syntax
3. Ensure database permissions are correct
4. Check MySQL error logs for detailed error messages

