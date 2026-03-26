# Fix for updateDB.sh transaksi.sql Error

## Problem
When running `updateDB.sh` on production server, Step 3 fails with:
```
bash: /var/transaksi.sql: No such file or directory
```

## Root Cause
The `updateDB.sh` script tries to run `transaksi.sql` from `/var/transaksi.sql` inside the Docker container, but:
1. `transaksi.sql` is not mounted in the Docker container volumes
2. `deploy.sh` doesn't sync `transaksi.sql` to the container (only syncs `updates.sql`)

## Solution
Apply the following changes to the **Plex-Cash** backend repository:

### 1. Update `docker-compose.prod.yml`

**Location**: Line 333-337 (db service volumes section)

**Change from**:
```yaml
    volumes:
      - "${MYSQL_DATA_PATH}:/var/lib/mysql"
      - "${MYSQL_BACKUP_PATH}:/var/lib/backup"
      - "./my.cnf:/etc/my.cnf"
      - "./updates.sql:/var/updates.sql"
```

**Change to**:
```yaml
    volumes:
      - "${MYSQL_DATA_PATH}:/var/lib/mysql"
      - "${MYSQL_BACKUP_PATH}:/var/lib/backup"
      - "./my.cnf:/etc/my.cnf"
      - "./updates.sql:/var/updates.sql"
      - "./transaksi.sql:/var/transaksi.sql"
```

### 2. Update `docker-compose.dev.yml`

**Location**: Line 34-37 (db service volumes section)

**Change from**:
```yaml
    volumes:
      - "${MYSQL_DATA_PATH}:/var/lib/mysql"
      - "./my.cnf:/etc/my.cnf"
      - "./updates.sql:/var/updates.sql"
```

**Change to**:
```yaml
    volumes:
      - "${MYSQL_DATA_PATH}:/var/lib/mysql"
      - "./my.cnf:/etc/my.cnf"
      - "./updates.sql:/var/updates.sql"
      - "./transaksi.sql:/var/transaksi.sql"
```

### 3. Update `deploy.sh`

**Location**: After line 134 (after the updates.sql sync section)

**Add this new section**:
```bash
# Sync transaksi.sql file into database container
echo "========================================="
echo "Syncing transaksi.sql to database container..."
echo "========================================="

# Check if transaksi.sql exists
if [ ! -f "./transaksi.sql" ]; then
    echo "⚠ Warning: transaksi.sql file not found in current directory"
    echo "  Skipping transaksi.sql sync"
else
    # Check if database container is running
    if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        echo "Database container found: $DB_CONTAINER"

        # Copy the updated file into the container
        set +e
        docker exec -i "$DB_CONTAINER" sh -c 'cat > /tmp/transaksi.sql' < ./transaksi.sql
        COPY_RESULT=$?
        set -e

        if [ $COPY_RESULT -eq 0 ]; then
            # Write to the mounted file location
            set +e
            docker exec "$DB_CONTAINER" sh -c 'cat /tmp/transaksi.sql > /var/transaksi.sql'
            WRITE_RESULT=$?
            set -e

            if [ $WRITE_RESULT -eq 0 ]; then
                echo "✓ Successfully synced transaksi.sql to container"

                # Verify the sync
                HOST_MD5=$(md5sum ./transaksi.sql 2>/dev/null | awk '{print $1}')
                CONTAINER_MD5=$(docker exec "$DB_CONTAINER" md5sum /var/transaksi.sql 2>/dev/null | awk '{print $1}')

                if [ -n "$HOST_MD5" ] && [ -n "$CONTAINER_MD5" ]; then
                    if [ "$HOST_MD5" = "$CONTAINER_MD5" ]; then
                        echo "✓ Verification passed - MD5 checksums match: $HOST_MD5"
                    else
                        echo "⚠ Warning: MD5 checksums don't match"
                        echo "  Host: $HOST_MD5"
                        echo "  Container: $CONTAINER_MD5"
                    fi
                else
                    echo "⚠ Warning: Could not verify MD5 checksums"
                fi
            else
                echo "⚠ Warning: Failed to write transaksi.sql in container (exit code: $WRITE_RESULT)"
            fi
        else
            echo "⚠ Warning: Failed to copy transaksi.sql to container (exit code: $COPY_RESULT)"
        fi
    else
        echo "⚠ Warning: Database container '$DB_CONTAINER' not found or not running"
        echo "  Skipping transaksi.sql sync"
    fi
fi
echo ""
```

## Deployment Steps

1. Apply the changes above to the Plex-Cash repository
2. Commit and push the changes
3. On the production server, pull the latest changes:
   ```bash
   cd /path/to/Plex-Cash
   git pull
   ```
4. Run deployment to update the container configuration:
   ```bash
   bash deploy.sh --no-downtime
   ```
5. Now you can run `updateDB.sh` successfully:
   ```bash
   bash updateDB.sh
   ```

## Notes
- The volume mount will only take effect after the container is recreated (via `deploy.sh`)
- The sync script in `deploy.sh` ensures the file is updated even if the container is already running
- This follows the same pattern as `updates.sql` which is already working correctly

