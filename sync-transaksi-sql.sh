#!/bin/bash

# Quick script to manually sync transaksi.sql to the database container
# Use this as a temporary workaround until deploy.sh is updated

echo "========================================="
echo "Manual transaksi.sql Sync Script"
echo "========================================="
echo ""

DB_CONTAINER="plexseller_main_db"

# Check if transaksi.sql exists
if [ ! -f "./transaksi.sql" ]; then
    echo "❌ Error: transaksi.sql file not found in current directory"
    echo "   Please run this script from the Plex-Cash repository root"
    exit 1
fi

# Check if database container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "❌ Error: Database container '$DB_CONTAINER' not found or not running"
    echo "   Please start the database container first:"
    echo "   bash deploy.sh --no-downtime"
    exit 1
fi

echo "✓ Found transaksi.sql"
echo "✓ Database container is running"
echo ""
echo "Syncing transaksi.sql to container..."

# Copy the file into the container
set +e
docker exec -i "$DB_CONTAINER" sh -c 'cat > /tmp/transaksi.sql' < ./transaksi.sql
COPY_RESULT=$?
set -e

if [ $COPY_RESULT -ne 0 ]; then
    echo "❌ Failed to copy transaksi.sql to container (exit code: $COPY_RESULT)"
    exit 1
fi

# Write to the mounted file location
set +e
docker exec "$DB_CONTAINER" sh -c 'cat /tmp/transaksi.sql > /var/transaksi.sql'
WRITE_RESULT=$?
set -e

if [ $WRITE_RESULT -ne 0 ]; then
    echo "❌ Failed to write transaksi.sql in container (exit code: $WRITE_RESULT)"
    exit 1
fi

echo "✓ Successfully synced transaksi.sql to container"
echo ""

# Verify the sync
echo "Verifying sync..."
HOST_MD5=$(md5sum ./transaksi.sql 2>/dev/null | awk '{print $1}')
CONTAINER_MD5=$(docker exec "$DB_CONTAINER" md5sum /var/transaksi.sql 2>/dev/null | awk '{print $1}')

if [ -n "$HOST_MD5" ] && [ -n "$CONTAINER_MD5" ]; then
    if [ "$HOST_MD5" = "$CONTAINER_MD5" ]; then
        echo "✓ Verification passed - MD5 checksums match: $HOST_MD5"
    else
        echo "⚠ Warning: MD5 checksums don't match"
        echo "  Host: $HOST_MD5"
        echo "  Container: $CONTAINER_MD5"
        exit 1
    fi
else
    echo "⚠ Warning: Could not verify MD5 checksums"
fi

echo ""
echo "========================================="
echo "✅ transaksi.sql sync completed!"
echo "========================================="
echo ""
echo "You can now run: bash updateDB.sh"

