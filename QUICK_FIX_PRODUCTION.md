# Quick Fix for Production Server

## Immediate Workaround (No Code Changes Required)

If you need to run `updateDB.sh` **right now** on production without waiting for code changes, use this manual workaround:

### Option 1: Manual Sync (Recommended)

```bash
# 1. Navigate to Plex-Cash repository
cd /path/to/Plex-Cash

# 2. Verify transaksi.sql exists
ls -la transaksi.sql

# 3. Manually copy transaksi.sql to the container
docker exec -i plexseller_main_db sh -c 'cat > /var/transaksi.sql' < ./transaksi.sql

# 4. Verify the file is in the container
docker exec plexseller_main_db ls -la /var/transaksi.sql

# 5. Now run updateDB.sh
bash updateDB.sh
```

### Option 2: Use the Sync Script

```bash
# 1. Navigate to Plex-Cash repository
cd /path/to/Plex-Cash

# 2. Make the sync script executable
chmod +x sync-transaksi-sql.sh

# 3. Run the sync script
bash sync-transaksi-sql.sh

# 4. Run updateDB.sh
bash updateDB.sh
```

### Option 3: Run SQL Directly (Skip updateDB.sh Step 3)

If you only need to run `transaksi.sql` on specific databases:

```bash
# For a single database
docker exec -i plexseller_main_db mysql -uroot -pmantab99 "user@example.com" < ./transaksi.sql

# For all user databases (loop)
for db in $(docker exec plexseller_main_db mysql -uroot -pmantab99 -s -N -e "show databases" 2>&1 | grep '@'); do
    db=$(echo "$db" | tr -d '[:space:]')
    echo "Running transaksi.sql on: $db"
    docker exec -i plexseller_main_db mysql -uroot -pmantab99 "$db" < ./transaksi.sql
done
```

## Permanent Fix (Requires Code Changes)

Follow the instructions in `UPDATEDB_TRANSAKSI_FIX.md` to apply permanent fixes to:
1. `docker-compose.prod.yml`
2. `docker-compose.dev.yml`
3. `deploy.sh`

Then deploy:
```bash
git pull
bash deploy.sh --no-downtime
```

## Verification

After syncing, verify the file exists in the container:

```bash
# Check if file exists
docker exec plexseller_main_db ls -la /var/transaksi.sql

# Check file size
docker exec plexseller_main_db wc -l /var/transaksi.sql

# View first few lines
docker exec plexseller_main_db head -20 /var/transaksi.sql
```

## Troubleshooting

### Error: "No such file or directory"
- Make sure you're in the Plex-Cash repository root directory
- Verify `transaksi.sql` exists: `ls -la transaksi.sql`

### Error: "Container not found"
- Check if container is running: `docker ps | grep plexseller_main_db`
- Start the container: `bash deploy.sh --no-downtime`

### Error: "Permission denied"
- Make sure the script is executable: `chmod +x sync-transaksi-sql.sh`
- Or run with bash: `bash sync-transaksi-sql.sh`

## Notes

- The manual sync is **temporary** - it will be lost if the container is recreated
- For a permanent solution, apply the code changes in `UPDATEDB_TRANSAKSI_FIX.md`
- The sync only needs to be done once per container lifecycle
- If you restart/recreate the container, you'll need to sync again (unless you've applied the permanent fix)

