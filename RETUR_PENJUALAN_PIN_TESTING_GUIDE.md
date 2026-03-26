# Retur Penjualan PIN Feature - Testing Guide

## Prerequisites

1. **Database Migration**
   ```bash
   # Run the updates.sql migration
   mysql -u [username] -p [database_name] < updates.sql
   ```

2. **Server Restart**
   - Restart the backend server to load new routes and controllers

3. **Test Users**
   - Admin user account (for PIN management)
   - Regular user account (for testing PIN validation)

## Test Scenarios

### Scenario 1: Database Schema Verification

**Objective:** Verify that the database columns were added correctly

**Steps:**
1. Connect to your database
2. Run the following query:
   ```sql
   DESCRIBE user;
   ```

**Expected Result:**
- `retur_penjualan_pin` column exists (VARCHAR(10))
- `retur_penjualan_requires_pin` column exists (TINYINT(1))
- `pin_created_at` column exists (DATETIME)

**Verification Query:**
```sql
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'user' 
AND COLUMN_NAME IN ('retur_penjualan_pin', 'retur_penjualan_requires_pin', 'pin_created_at');
```

---

### Scenario 2: Web UI - Enable PIN Requirement

**Objective:** Test enabling PIN requirement for a user

**Steps:**
1. Login to web app as admin
2. Navigate to Master > User
3. Enter a user's email and search
4. Scroll to "Retur Penjualan PIN" section
5. Check "Memerlukan PIN untuk Retur Penjualan"
6. Click "Simpan Pengaturan"

**Expected Result:**
- Success message: "Berhasil menyimpan pengaturan user!"
- Database verification:
  ```sql
  SELECT email, retur_penjualan_requires_pin 
  FROM user 
  WHERE email = '[test_email]';
  ```
  Should show `retur_penjualan_requires_pin = 1`

---

### Scenario 3: Web UI - Generate PIN

**Objective:** Test PIN generation

**Steps:**
1. Login to web app as admin
2. Navigate to Master > User
3. Select a user with PIN requirement enabled
4. Click "Generate PIN" button

**Expected Result:**
- Success message showing the generated PIN (e.g., "PIN berhasil dibuat: 123456")
- PIN appears in the text field
- Timestamp appears below the PIN field
- Database verification:
  ```sql
  SELECT email, retur_penjualan_pin, pin_created_at 
  FROM user 
  WHERE email = '[test_email]';
  ```
  Should show the generated PIN and timestamp

---

### Scenario 4: API - Generate PIN (Direct Test)

**Objective:** Test PIN generation API endpoint

**Steps:**
1. Use Postman or curl to test the endpoint
   ```bash
   curl -X POST http://localhost:3000/user/retur-penjualan/pin/generate \
     -H "Content-Type: application/json" \
     -H "Cookie: authorization=[your_auth_token]" \
     -d '{"email": "test@example.com"}'
   ```

**Expected Result:**
```json
{
  "status": true,
  "pin": "123456",
  "message": "PIN generated successfully"
}
```

---

### Scenario 5: API - Validate PIN (Correct PIN)

**Objective:** Test PIN validation with correct PIN

**Steps:**
1. Use Postman or curl:
   ```bash
   curl -X POST http://localhost:3000/user/retur-penjualan/pin/validate \
     -H "Content-Type: application/json" \
     -H "Cookie: authorization=[user_auth_token]" \
     -d '{"pin": "123456"}'
   ```

**Expected Result:**
```json
{
  "status": true,
  "message": "PIN validated successfully"
}
```

---

### Scenario 6: API - Validate PIN (Incorrect PIN)

**Objective:** Test PIN validation with incorrect PIN

**Steps:**
1. Use Postman or curl:
   ```bash
   curl -X POST http://localhost:3000/user/retur-penjualan/pin/validate \
     -H "Content-Type: application/json" \
     -H "Cookie: authorization=[user_auth_token]" \
     -d '{"pin": "999999"}'
   ```

**Expected Result:**
```json
{
  "status": false,
  "reason": "Invalid PIN"
}
```

---

### Scenario 7: Sales Return - Without PIN (PIN Required)

**Objective:** Test sales return creation when PIN is required but not provided

**Steps:**
1. Ensure user has `retur_penjualan_requires_pin = 1`
2. Attempt to create a sales return without providing PIN:
   ```bash
   curl -X POST http://localhost:3000/transaksi/penjualan/retur \
     -H "Content-Type: application/json" \
     -H "Cookie: authorization=[user_auth_token]" \
     -d '{
       "id_penjualan": 1,
       "tanggal": "2026-01-11",
       "items": [{"id": 1, "qty": 1, "harga_jual": 10000}]
     }'
   ```

**Expected Result:**
```json
{
  "status": false,
  "reason": "PIN diperlukan untuk retur penjualan. Silakan hubungi admin untuk mendapatkan PIN."
}
```

---

### Scenario 8: Sales Return - With Correct PIN

**Objective:** Test sales return creation with correct PIN

**Steps:**
1. Ensure user has `retur_penjualan_requires_pin = 1` and a valid PIN
2. Create sales return with PIN:
   ```bash
   curl -X POST http://localhost:3000/transaksi/penjualan/retur \
     -H "Content-Type: application/json" \
     -H "Cookie: authorization=[user_auth_token]" \
     -d '{
       "id_penjualan": 1,
       "tanggal": "2026-01-11",
       "pin": "123456",
       "items": [{"id": 1, "qty": 1, "harga_jual": 10000}]
     }'
   ```

**Expected Result:**
```json
{
  "status": true,
  "id": [new_retur_id]
}
```

---

### Scenario 9: Sales Return - User Without PIN Requirement

**Objective:** Test that users without PIN requirement can create returns normally

**Steps:**
1. Ensure user has `retur_penjualan_requires_pin = 0`
2. Create sales return without PIN:
   ```bash
   curl -X POST http://localhost:3000/transaksi/penjualan/retur \
     -H "Content-Type: application/json" \
     -H "Cookie: authorization=[user_auth_token]" \
     -d '{
       "id_penjualan": 1,
       "tanggal": "2026-01-11",
       "items": [{"id": 1, "qty": 1, "harga_jual": 10000}]
     }'
   ```

**Expected Result:**
```json
{
  "status": true,
  "id": [new_retur_id]
}
```

---

### Scenario 10: Mobile App - PIN Modal

**Objective:** Test the PIN input modal component

**Steps:**
1. Open the mobile app
2. Navigate to a screen that uses ReturPenjualanPINModal
3. Trigger the modal to appear
4. Enter a PIN and submit

**Expected Result:**
- Modal appears with clean UI
- PIN input accepts 6-8 digits
- Validation occurs when clicking "Validasi"
- Success: Modal closes and proceeds
- Failure: Error message appears

**Note:** Full integration pending implementation of PenjualanReturScreen

---

## Test Checklist

- [ ] Database columns created successfully
- [ ] Web UI: Enable PIN requirement works
- [ ] Web UI: Generate PIN works
- [ ] Web UI: PIN data loads when selecting user
- [ ] Web UI: Settings save correctly
- [ ] API: Generate PIN endpoint works (admin only)
- [ ] API: Validate PIN endpoint works (correct PIN)
- [ ] API: Validate PIN endpoint rejects incorrect PIN
- [ ] API: Get PIN endpoint works (admin only)
- [ ] API: Update PIN requirement endpoint works
- [ ] Sales Return: Rejects when PIN required but not provided
- [ ] Sales Return: Rejects when PIN is incorrect
- [ ] Sales Return: Succeeds when PIN is correct
- [ ] Sales Return: Works normally for users without PIN requirement
- [ ] Mobile: PIN modal displays correctly
- [ ] Mobile: PIN validation works

## Common Issues and Solutions

### Issue 1: "Column already exists" error
**Solution:** The migration uses dynamic SQL to check for existing columns. If you see this error, the columns already exist. You can safely ignore it or verify with `DESCRIBE user;`

### Issue 2: "Only admin users can generate PINs"
**Solution:** Ensure you're logged in as an admin user. Check the `USER_MAPPING.ROLES` table to verify the user's role.

### Issue 3: PIN not loading in web UI
**Solution:** Check browser console for errors. Verify the `/user/retur-penjualan/pin` endpoint is accessible and returns data.

### Issue 4: Sales return still works without PIN
**Solution:** Verify that `retur_penjualan_requires_pin = 1` in the database for that user. Also check that the backend code changes were deployed.

## Database Cleanup (for testing)

To reset PIN data for a user:
```sql
UPDATE user 
SET 
    retur_penjualan_pin = NULL,
    retur_penjualan_requires_pin = 0,
    pin_created_at = NULL
WHERE email = '[test_email]';
```

To remove the columns (rollback migration):
```sql
ALTER TABLE user DROP COLUMN retur_penjualan_pin;
ALTER TABLE user DROP COLUMN retur_penjualan_requires_pin;
ALTER TABLE user DROP COLUMN pin_created_at;
ALTER TABLE user DROP INDEX idx_retur_pin;
```

