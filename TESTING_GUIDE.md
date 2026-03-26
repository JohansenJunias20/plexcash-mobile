# Testing Guide: Permanent Authentication

## ✅ Implementation Status

All changes have been successfully applied:
- ✅ Mobile app (AuthContext.tsx) - Skip validation on startup
- ✅ Backend (/auth/authorize-pin) - Remove token expiration
- ✅ Backend (/auth/authorize-device) - Remove token expiration
- ✅ Backend (/auth/validate-device) - Updated comments

## 🧪 How to Test

### Test 1: QR Code Login Persistence
**Goal:** Verify QR code login persists across app restarts

1. **Login with QR code:**
   - Open the app
   - Scan QR code from web dashboard
   - Verify you're logged in

2. **Close and reopen app:**
   - Force close the app completely
   - Reopen the app
   - **Expected:** You should be logged in immediately (no loading/validation)
   - **Check logs:** Should see "✅ [AUTH] Found QR-code auth token, restoring session (no validation)"

3. **Wait several days:**
   - Leave app closed for 2-3 days
   - Reopen the app
   - **Expected:** Still logged in (no expiration)

### Test 2: PIN Code Login Persistence
**Goal:** Verify PIN login persists across app restarts

1. **Login with PIN:**
   - Open the app
   - Enter email and PIN code
   - Verify you're logged in

2. **Close and reopen app:**
   - Force close the app
   - Reopen the app
   - **Expected:** You should be logged in immediately
   - **Check logs:** Should see "✅ [AUTH] Device is authorized, restoring session (no validation)"

3. **Wait several days:**
   - Leave app closed for 2-3 days
   - Reopen the app
   - **Expected:** Still logged in

### Test 3: Manual Logout
**Goal:** Verify logout still works correctly

1. **While logged in:**
   - Tap "Sign Out" button
   - **Expected:** Logged out and returned to login screen

2. **Reopen app:**
   - Close and reopen app
   - **Expected:** Should see login screen (not auto-logged in)

3. **Check storage:**
   - Verify AsyncStorage is cleared
   - No authToken, userEmail, or isAuthenticated values

### Test 4: API Calls with Permanent Tokens
**Goal:** Verify API calls work with non-expiring tokens

1. **After logging in:**
   - Navigate through the app
   - Try various features (orders, products, etc.)
   - **Expected:** All API calls succeed

2. **After several days:**
   - Wait 2-3 days without opening app
   - Open app and try API calls
   - **Expected:** All API calls still work

### Test 5: Multiple Devices
**Goal:** Verify each device maintains its own session

1. **Login on Device A:**
   - Login with QR code or PIN
   - Verify logged in

2. **Login on Device B:**
   - Login with same account
   - Verify logged in

3. **Both devices:**
   - Both should remain logged in
   - Both should work independently

## 📊 What to Check in Logs

### Successful Startup (Already Logged In)
```
🔍 [AUTH] Device authorized status: true
✅ [AUTH] Device is authorized, restoring session (no validation)
```
OR
```
✅ [AUTH] Found QR-code auth token, restoring session (no validation)
```

### Successful Login (New)
```
🔐 [AUTHORIZE-PIN] ✅ Token payload BEFORE signing: {...}
```
OR
```
🔐 [AUTHORIZE-DEVICE] ✅ Token payload BEFORE signing: {...}
```

### Successful Logout
```
🔓 [SIGN-OUT] Signing out...
🔓 [SIGN-OUT] Cleared all auth data
```

## ⚠️ Potential Issues to Watch For

### Issue 1: User Email Not Stored
**Symptom:** App logs out on restart even though device is authorized
**Cause:** userEmail not saved in AsyncStorage during login
**Check:** Look for "❌ [AUTH] No user email found, clearing device auth" in logs
**Fix:** Ensure login flow saves userEmail to AsyncStorage

### Issue 2: AsyncStorage Not Persisting
**Symptom:** App always shows login screen on restart
**Cause:** AsyncStorage data being cleared by OS or app
**Check:** Manually inspect AsyncStorage values
**Fix:** Verify AsyncStorage is properly configured

### Issue 3: Token Signature Mismatch
**Symptom:** API calls fail with 403 errors
**Cause:** SECRET environment variable changed on backend
**Check:** Look for "JWT verification failed" in backend logs
**Fix:** Logout and login again to get new token

## 🔍 How to Verify Changes Were Applied

### Check Mobile App (AuthContext.tsx)
Look for these comments in the code:
- Line 62: `// PERMANENT AUTH: Skip device validation`
- Line 89: `// PERMANENT AUTH: Skip token validation`

### Check Backend (Server/index.ts)
Look for these comments:
- Line 3477: `// PERMANENT AUTH: Remove expiresIn to create tokens that never expire`
- Line 3738: `// PERMANENT AUTH: Remove expiresIn to create tokens that never expire`
- Line 3266: `// PERMANENT AUTH: Tokens no longer have expiration`

## 🚀 Quick Verification Steps

1. **Check files were modified:**
   ```bash
   git diff context/AuthContext.tsx
   git diff Server/index.ts
   ```

2. **Restart backend server:**
   - Stop the backend
   - Start it again
   - New tokens will be created without expiration

3. **Test on mobile:**
   - Login once
   - Close app
   - Reopen app
   - Should be logged in immediately

## ✅ Success Criteria

- [ ] QR code login persists across app restarts
- [ ] PIN login persists across app restarts
- [ ] No validation API calls on app startup
- [ ] Manual logout works correctly
- [ ] API calls work with permanent tokens
- [ ] Tokens work after several days
- [ ] Multiple devices can stay logged in simultaneously

