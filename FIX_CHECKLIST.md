# updateDB.sh transaksi.sql Fix - Implementation Checklist

## 🎯 Choose Your Path

- [ ] **Path A: Quick Fix (Immediate)** - For urgent production use
- [ ] **Path B: Permanent Fix (Recommended)** - For long-term solution
- [ ] **Path C: Both** - Quick fix now, permanent fix later

---

## 📋 Path A: Quick Fix Checklist

### Prerequisites
- [ ] SSH access to production server
- [ ] Access to Plex-Cash repository on server
- [ ] Docker is running
- [ ] `plexseller_main_db` container is running

### Steps
- [ ] Navigate to Plex-Cash repository
  ```bash
  cd /path/to/Plex-Cash
  ```

- [ ] Verify `transaksi.sql` exists
  ```bash
  ls -la transaksi.sql
  ```

- [ ] Copy file to container
  ```bash
  docker exec -i plexseller_main_db sh -c 'cat > /var/transaksi.sql' < ./transaksi.sql
  ```

- [ ] Verify file in container
  ```bash
  docker exec plexseller_main_db ls -la /var/transaksi.sql
  ```

- [ ] Run updateDB.sh
  ```bash
  bash updateDB.sh
  ```

- [ ] Verify success (no "No such file" errors)

### ⚠️ Important Notes
- This fix is **temporary** - lost if container is recreated
- You'll need to repeat this after container restarts
- Consider applying Path B for permanent solution

---

## 🔧 Path B: Permanent Fix Checklist

### Prerequisites
- [ ] Git access to Plex-Cash repository
- [ ] Ability to commit and push changes
- [ ] Ability to deploy to production

### Step 1: Update docker-compose.prod.yml
- [ ] Open `docker-compose.prod.yml`
- [ ] Find the `db` service (around line 323)
- [ ] Locate the `volumes` section (around line 333-337)
- [ ] Add new line: `- "./transaksi.sql:/var/transaksi.sql"`
- [ ] Save file

### Step 2: Update docker-compose.dev.yml
- [ ] Open `docker-compose.dev.yml`
- [ ] Find the `db` service (around line 25)
- [ ] Locate the `volumes` section (around line 34-37)
- [ ] Add new line: `- "./transaksi.sql:/var/transaksi.sql"`
- [ ] Save file

### Step 3: Update deploy.sh
- [ ] Open `deploy.sh`
- [ ] Find the `updates.sql` sync section (around line 74-134)
- [ ] After line 134, add the new `transaksi.sql` sync section
- [ ] Copy the code from `UPDATEDB_TRANSAKSI_FIX.md` section 3
- [ ] Save file

### Step 4: Test Locally (Optional but Recommended)
- [ ] Run local deployment
  ```bash
  docker-compose -f docker-compose.dev.yml up -d
  ```

- [ ] Verify file is mounted
  ```bash
  docker exec plexseller_main_db ls -la /var/transaksi.sql
  ```

- [ ] Test updateDB.sh locally
  ```bash
  bash updateDB.sh
  ```

### Step 5: Commit and Push
- [ ] Stage changes
  ```bash
  git add docker-compose.prod.yml docker-compose.dev.yml deploy.sh
  ```

- [ ] Commit with descriptive message
  ```bash
  git commit -m "Fix: Add transaksi.sql mount and sync to database container"
  ```

- [ ] Push to repository
  ```bash
  git push origin main
  ```

### Step 6: Deploy to Production
- [ ] SSH to production server
- [ ] Navigate to Plex-Cash repository
  ```bash
  cd /path/to/Plex-Cash
  ```

- [ ] Pull latest changes
  ```bash
  git pull origin main
  ```

- [ ] Deploy with zero-downtime
  ```bash
  bash deploy.sh --no-downtime
  ```

- [ ] Wait for deployment to complete

### Step 7: Verify Production
- [ ] Check file exists in container
  ```bash
  docker exec plexseller_main_db ls -la /var/transaksi.sql
  ```

- [ ] Verify file content
  ```bash
  docker exec plexseller_main_db head -20 /var/transaksi.sql
  ```

- [ ] Run updateDB.sh
  ```bash
  bash updateDB.sh
  ```

- [ ] Verify all steps complete successfully

### Step 8: Documentation
- [ ] Update deployment documentation if needed
- [ ] Notify team of the fix
- [ ] Close any related tickets/issues

---

## ✅ Success Criteria

### Quick Fix Success
- [ ] No "No such file or directory" errors when running `updateDB.sh`
- [ ] Step 3 of `updateDB.sh` completes successfully
- [ ] All databases are updated with `transaksi.sql`

### Permanent Fix Success
- [ ] All Quick Fix success criteria met
- [ ] Changes committed to repository
- [ ] Production deployment successful
- [ ] File persists after container restart
- [ ] `deploy.sh` shows successful sync of both `updates.sql` and `transaksi.sql`

---

## 🆘 Troubleshooting

If you encounter issues, check:
- [ ] `QUICK_FIX_PRODUCTION.md` - Troubleshooting section
- [ ] `UPDATEDB_TRANSAKSI_FIX.md` - Detailed fix instructions
- [ ] Docker container logs: `docker logs plexseller_main_db`
- [ ] File exists on host: `ls -la transaksi.sql`
- [ ] Container is running: `docker ps | grep plexseller_main_db`

