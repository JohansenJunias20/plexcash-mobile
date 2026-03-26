# updateDB.sh transaksi.sql Fix - Complete Guide

## 📋 Problem Summary

When running `bash updateDB.sh` on the production server, Step 3 fails with:
```
📋 Step 3: Running transaksi.sql...
==========================================
DATABASE NAME: 'user@example.com'
bash: /var/transaksi.sql: No such file or directory
```

## 🔍 Root Cause

The `updateDB.sh` script expects `transaksi.sql` to be available at `/var/transaksi.sql` inside the Docker container, but:

1. ❌ `docker-compose.prod.yml` doesn't mount `transaksi.sql` into the container
2. ❌ `deploy.sh` doesn't sync `transaksi.sql` to the container
3. ✅ Only `updates.sql` is properly mounted and synced

## 🚀 Quick Fix (Immediate)

**For immediate use on production server:**

See: **`QUICK_FIX_PRODUCTION.md`**

Quick command:
```bash
cd /path/to/Plex-Cash
docker exec -i plexseller_main_db sh -c 'cat > /var/transaksi.sql' < ./transaksi.sql
bash updateDB.sh
```

Or use the helper script:
```bash
bash sync-transaksi-sql.sh
bash updateDB.sh
```

## 🔧 Permanent Fix (Recommended)

**For long-term solution:**

See: **`UPDATEDB_TRANSAKSI_FIX.md`**

This document contains detailed instructions to update:
1. `docker-compose.prod.yml` - Add volume mount
2. `docker-compose.dev.yml` - Add volume mount
3. `deploy.sh` - Add sync logic

## 📁 Files in This Fix Package

| File | Purpose |
|------|---------|
| `README_UPDATEDB_FIX.md` | This file - overview and navigation |
| `UPDATEDB_TRANSAKSI_FIX.md` | Detailed permanent fix instructions |
| `QUICK_FIX_PRODUCTION.md` | Immediate workaround for production |
| `sync-transaksi-sql.sh` | Helper script to manually sync the file |

## 🎯 Recommended Approach

### For Production (Right Now)
1. Use the quick fix from `QUICK_FIX_PRODUCTION.md`
2. Run `updateDB.sh` to complete your current task

### For Long-Term (Next Deployment)
1. Apply changes from `UPDATEDB_TRANSAKSI_FIX.md` to the Plex-Cash repository
2. Commit and push the changes
3. Deploy with `bash deploy.sh --no-downtime`
4. Future runs of `updateDB.sh` will work automatically

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Host Machine (Plex-Cash Repository)                         │
│                                                              │
│  ├── updates.sql      ✅ Mounted & Synced                   │
│  └── transaksi.sql    ❌ NOT Mounted (ISSUE)                │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ Docker Volume Mount
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Docker Container (plexseller_main_db)                       │
│                                                              │
│  ├── /var/updates.sql      ✅ Available                     │
│  └── /var/transaksi.sql    ❌ Missing (ERROR)               │
│                                                              │
│  updateDB.sh tries to run:                                  │
│  mysql ... < /var/transaksi.sql  ❌ FAILS                   │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Verification Steps

After applying the fix (quick or permanent):

```bash
# 1. Check file exists in container
docker exec plexseller_main_db ls -la /var/transaksi.sql

# 2. Verify file content
docker exec plexseller_main_db head -20 /var/transaksi.sql

# 3. Run updateDB.sh
bash updateDB.sh

# 4. Check for success (no "No such file" errors)
```

## 🆘 Support

If you encounter issues:

1. Check `QUICK_FIX_PRODUCTION.md` troubleshooting section
2. Verify Docker container is running: `docker ps | grep plexseller_main_db`
3. Verify file exists on host: `ls -la transaksi.sql`
4. Check container logs: `docker logs plexseller_main_db`

## 📝 Notes

- The quick fix is temporary and will be lost if the container is recreated
- The permanent fix ensures the file is always available
- This follows the same pattern as `updates.sql` which already works correctly
- Both `updates.sql` and `transaksi.sql` should be treated the same way

