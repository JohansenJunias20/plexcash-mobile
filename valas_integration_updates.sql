-- ============================================
-- VALAS PEMBELIAN INTEGRATION TO TRANSAKSI VIEW
-- ============================================
-- Date: 2025-12-25
-- Purpose: Add kode_ba_valas column and integrate valas_pembelian into transaksi view
-- Changes:
--   1. ALTER TABLE valas_pembelian to add kode_ba_valas column
--   2. INSERT default CNY account into baganakun (111.3 - Kas CNY)
--   3. Add indexes for performance
-- ============================================

-- Step 1: Add kode_ba_valas column to valas_pembelian table
ALTER TABLE valas_pembelian 
ADD COLUMN kode_ba_valas VARCHAR(50) NULL AFTER kode_baganakun,
ADD INDEX idx_kode_ba_valas (kode_ba_valas);

-- Step 2: Insert default CNY account into baganakun
-- This account will be used for CNY currency purchases
INSERT INTO baganakun (kode, nama, kode_induk, depth, stop, `lock`)
VALUES ('111.3', 'Kas CNY', '111', 4, true, true)
ON DUPLICATE KEY UPDATE 
    nama = 'Kas CNY',
    kode_induk = '111',
    depth = 4,
    stop = true,
    `lock` = true;

-- Step 3: Update existing valas_pembelian records to set kode_ba_valas for CNY
-- This sets kode_ba_valas = '111.3' for all existing CNY purchases
UPDATE valas_pembelian vp
JOIN valas_master vm ON vp.id_valas = vm.id
SET vp.kode_ba_valas = '111.3'
WHERE vm.kode = 'CNY' AND vp.kode_ba_valas IS NULL;

-- Step 4: Add index on tanggal for better performance in transaksi view
-- (This index may already exist, so we use IF NOT EXISTS pattern)
-- Note: MySQL doesn't support IF NOT EXISTS for indexes, so we'll skip if it fails
-- ALTER TABLE valas_pembelian ADD INDEX idx_tanggal_kode_ba_valas (tanggal, kode_ba_valas);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries to verify the changes:

-- 1. Check if column was added successfully
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'valas_pembelian' AND COLUMN_NAME = 'kode_ba_valas';

-- 2. Check if CNY account was created
-- SELECT * FROM baganakun WHERE kode = '111.3';

-- 3. Check updated valas_pembelian records
-- SELECT vp.id, vm.kode, vm.nama, vp.kode_baganakun, vp.kode_ba_valas, vp.total_idr
-- FROM valas_pembelian vp
-- JOIN valas_master vm ON vp.id_valas = vm.id
-- ORDER BY vp.id DESC
-- LIMIT 10;

-- ============================================
-- NOTES
-- ============================================
-- 1. The kode_ba_valas column is nullable to allow for gradual migration
-- 2. Frontend should automatically set kode_ba_valas based on currency selection
-- 3. For CNY: kode_ba_valas = '111.3'
-- 4. For other currencies, create similar accounts (e.g., '111.4' for USD)
-- 5. The transaksi view will be updated in a separate file (transaksi.sql)
-- ============================================

