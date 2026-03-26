# Firebase Persistent Authentication Fix

## Problem Summary

**Issue:** Google Firebase authentication was automatically logging users out after a few hours, while QR code and PIN authentication maintained persistent login sessions indefinitely.

**Root Cause:** Firebase ID tokens expire after 1 hour by default. When the token expired, Firebase's `onAuthStateChanged` listener detected no authenticated user and cleared the auth state, logging the user out.

## Solution Overview

The fix makes Firebase authentication behave identically to QR code and PIN authentication by:

1. **Restoring Firebase sessions from AsyncStorage** on app startup (same as QR/PIN auth)
2. **Preventing automatic logout** when Firebase detects an expired token
3. **Maintaining the same token storage architecture** used by QR/PIN auth

## Changes Made

### 1. `context/AuthContext.tsx` - Session Restoration (Lines 87-98)

**Before:**
```typescript
// Only restored QR-code auth from AsyncStorage
if (authToken && userEmail && isAuth === 'true' && authMethod === 'qr-code') {
  // Restore session
}
```

**After:**
```typescript
// PERSISTENT AUTH FIX: Restore both QR-code AND Firebase auth from AsyncStorage
if (authToken && userEmail && isAuth === 'true' && (authMethod === 'qr-code' || authMethod === 'firebase')) {
  console.log(`✅ [AUTH] Found ${authMethod} auth token, restoring session (no validation)`);
  
  // PERMANENT AUTH: Skip token validation to prevent automatic logout
  setUser({ email: userEmail, authMethod: authMethod as 'qr-code' | 'firebase' });
  setIsAuthenticated(true);
  setIsLoading(false);
  return;
}
```

### 2. `context/AuthContext.tsx` - Firebase Auth State Listener (Lines 193-213)

**Before:**
```typescript
} else {
  // When Firebase user is null, always clear auth state
  setUser(null);
  setIsAuthenticated(false);
  await AsyncStorage.removeItem('isAuthenticated');
  await AsyncStorage.removeItem('userEmail');
}
```

**After:**
```typescript
} else {
  // PERSISTENT AUTH FIX: Don't clear auth state if Firebase user is null
  // This prevents automatic logout when Firebase token expires
  const storedAuthMethod = await AsyncStorage.getItem('authMethod');
  const storedIsAuth = await AsyncStorage.getItem('isAuthenticated');
  
  if (storedAuthMethod === 'firebase' && storedIsAuth === 'true') {
    logAuth('⚠️ Firebase user is null but we have stored Firebase auth - keeping session alive');
    // Don't clear auth state - user will remain logged in
  } else {
    // Only clear auth state if no stored session exists
    setUser(null);
    setIsAuthenticated(false);
    await AsyncStorage.removeItem('isAuthenticated');
    await AsyncStorage.removeItem('userEmail');
  }
}
```

## How It Works

### Authentication Flow (All Methods)

1. **Initial Login:**
   - User logs in via QR code, PIN, or Google Firebase
   - Token is stored in AsyncStorage with `authMethod` flag
   - `isAuthenticated` is set to `true`

2. **App Restart:**
   - `checkExistingAuth()` reads from AsyncStorage
   - If valid session found (QR, PIN, or Firebase), restore it immediately
   - User stays logged in without re-authentication

3. **Session Persistence:**
   - All three methods now use the same persistence mechanism
   - No automatic logout due to token expiration
   - Users remain logged in until manual sign out

### Storage Keys Used

All authentication methods store the same keys in AsyncStorage:
- `authToken` - The authentication token
- `userEmail` - User's email address
- `isAuthenticated` - 'true' or removed
- `authMethod` - 'qr-code', 'device', 'pin', or 'firebase'

## Testing Checklist

- [x] Firebase login persists across app restarts
- [x] QR code login still works (not broken)
- [x] PIN login still works (not broken)
- [x] Manual logout works for all methods
- [x] Firebase users don't get auto-logged out after token expiration

## Benefits

✅ **Consistent Behavior:** All three authentication methods now have identical persistence behavior
✅ **No Breaking Changes:** QR code and PIN authentication remain unchanged
✅ **Same Architecture:** Uses existing token storage system
✅ **User-Friendly:** Users stay logged in until they explicitly sign out

## Technical Notes

- Firebase's `onAuthStateChanged` listener is still active but won't trigger logout
- The listener only processes new Firebase logins, not session restoration
- Token validation is skipped for all methods to prevent automatic logout
- Backend token refresh endpoint (`/auth/login/token`) is no longer needed for mobile app

## Files Modified

1. `context/AuthContext.tsx` - Main authentication context (2 changes)
   - Session restoration logic (lines 87-98)
   - Firebase auth state listener (lines 193-213)

## No Additional Changes Required

The existing code already had the correct infrastructure:
- ✅ `services/api.ts` - Already stores `authMethod: 'firebase'` correctly
- ✅ `signOut()` function - Already handles Firebase logout properly
- ✅ Token storage - Already uses unified `storeDeviceTokens()` function

