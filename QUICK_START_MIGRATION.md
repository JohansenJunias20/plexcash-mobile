# Quick Start: Product Migration to PlexSeller

## 🎯 What You Have

✅ **migration-output.sql** - Ready-to-import SQL file with 4,925 statements
✅ **migrate_products.py** - Python script for regenerating SQL if needed
✅ **Documentation** - Complete guides and references

## ⚡ 5-Minute Setup

### Step 1: Backup (2 minutes)
```bash
# Create a backup of your current database
mysqldump -u your_username -p your_database_name > backup_$(date +%Y%m%d).sql
```

### Step 2: Import (1 minute)
```bash
# Import the migration SQL file
mysql -u your_username -p your_database_name < migration-output.sql
```

### Step 3: Verify (2 minutes)
```bash
# Check the import was successful
mysql -u your_username -p your_database_name -e "
  SELECT 'masterbarang' as table_name, COUNT(*) as count FROM masterbarang
  UNION ALL
  SELECT 'bundling', COUNT(*) FROM bundling
  UNION ALL
  SELECT 'detailbundling', COUNT(*) FROM detailbundling;
"
```

Expected output:
```
table_name       | count
-----------------|------
masterbarang     | 1754
bundling         | 875
detailbundling   | 2316
```

## 📊 What Was Migrated

| Item | Count |
|------|-------|
| Products & Materials | 1,754 |
| Bundles | 875 |
| Bundle Items | 2,316 |

## ⚠️ Important Notes

1. **All prices are 0** - Update them in PlexSeller UI or with SQL
2. **All stock is 0** - Update inventory levels
3. **Categories are empty** - Assign categories as needed
4. **Brands are empty** - Add brand information

## 🔧 Update Prices (Optional)

```sql
-- Example: Set all prices to 10000
UPDATE masterbarang SET hargajual = 10000, hargabeli = 5000 WHERE hargajual = 0;

-- Example: Set bundle prices
UPDATE bundling SET hargajual = 50000 WHERE hargajual = 0;
```

## 🔄 Regenerate SQL (If Needed)

If you need to regenerate the SQL file from the Excel:

```bash
python3 migrate_products.py
```

This creates a new `migration-output.sql` file.

## 📚 Full Documentation

- **MIGRATION_SUMMARY.md** - Complete overview and statistics
- **PRODUCT_MIGRATION_GUIDE.md** - Detailed guide with troubleshooting
- **migrate_products.py** - Source code of the migration script

## ✅ Checklist

- [ ] Backup database
- [ ] Import migration-output.sql
- [ ] Verify row counts
- [ ] Update product prices
- [ ] Update inventory levels
- [ ] Assign product categories
- [ ] Add brand information
- [ ] Test bundling functionality

## 🆘 Troubleshooting

**Error: "Access denied"**
- Check MySQL username and password
- Verify database exists

**Error: "Duplicate entry"**
- Database already has some products
- Use backup to restore and try again

**Error: "Foreign key constraint"**
- SQL file handles this automatically
- Check MySQL error log for details

## 📞 Need Help?

1. Check PRODUCT_MIGRATION_GUIDE.md for detailed troubleshooting
2. Review the SQL file syntax
3. Verify database permissions
4. Check MySQL error logs

---

**Status**: ✅ Ready to Import
**File Size**: 642 KB
**Total Statements**: 4,925
**Execution Time**: ~30 seconds

