# Refresh Token Implementation - Mobile App

## 📋 Overview

This document describes the mobile app changes to support refresh token mechanism for permanent login. These changes work in conjunction with the backend changes documented in `REFRESH_TOKEN_IMPLEMENTATION_BACKEND.md`.

## ✅ Changes Completed

### 1. Updated Type Definitions (`services/api.ts`)

Added refresh token fields to `AuthorizeDeviceResponse` type:

```typescript
type AuthorizeDeviceResponse = {
  success: boolean;
  user?: { email: string; name?: string };
  token?: string;
  authToken?: string;
  refreshToken?: string;        // NEW: Refresh token for permanent login
  expiresIn?: number;           // NEW: Access token expiry in seconds
  refreshExpiresIn?: number;    // NEW: Refresh token expiry in seconds
  deviceId?: string;
  message?: string;
};
```

### 2. Updated `authorizeDevice()` Function

Modified to capture and return refresh token fields from backend:

```typescript
if (response.ok && result.success) {
  return {
    success: true,
    user: result.user,
    token: result.token,
    refreshToken: result.refreshToken,        // NEW
    expiresIn: result.expiresIn,             // NEW
    refreshExpiresIn: result.refreshExpiresIn, // NEW
    message: result.message,
    deviceId: result.deviceId,
  };
}
```

### 3. Updated `authorizePIN()` Function

Same changes as `authorizeDevice()` to support PIN-based authentication.

### 4. Updated `storeDeviceTokens()` Function

Enhanced to calculate and store token expiry timestamps:

```typescript
static async storeDeviceTokens(authData: { 
  authToken?: string; 
  token?: string; 
  refreshToken?: string; 
  expiresIn?: number;           // NEW
  refreshExpiresIn?: number;    // NEW
  deviceId?: string; 
  user: { email: string }; 
  authMethod?: 'device' | 'firebase' 
}) {
  // Calculate token expiry timestamps
  const now = Date.now();
  const tokenExpiry = authData.expiresIn 
    ? now + (authData.expiresIn * 1000) 
    : now + (3600 * 1000); // Default 1 hour
  const refreshTokenExpiry = authData.refreshExpiresIn 
    ? now + (authData.refreshExpiresIn * 1000) 
    : now + (90 * 24 * 60 * 60 * 1000); // Default 90 days

  // Store tokens and expiry timestamps
  await AsyncStorage.setItem('authToken', token);
  await AsyncStorage.setItem('refreshToken', authData.refreshToken || '');
  await AsyncStorage.setItem('tokenExpiry', tokenExpiry.toString());
  await AsyncStorage.setItem('refreshTokenExpiry', refreshTokenExpiry.toString());
  // ... rest of storage logic
}
```

### 5. Updated `validateDeviceAuth()` Function

Enhanced to update token expiry when token is refreshed:

```typescript
if (response.ok && data.success) {
  if (data.authToken && data.authToken !== authToken) {
    // Update token in both storage systems
    await AsyncStorage.setItem('authToken', data.authToken);
    await setTokenAuth(data.authToken);
    
    // NEW: Update token expiry timestamp
    if (data.expiresIn) {
      const newExpiry = Date.now() + (data.expiresIn * 1000);
      await AsyncStorage.setItem('tokenExpiry', newExpiry.toString());
    }
  }
  return data;
}
```

### 6. Updated AuthContext (`context/AuthContext.tsx`)

Modified both QR code and PIN authorization to pass refresh token data:

```typescript
// In authorizeDeviceWithQRCode()
await ApiService.storeDeviceTokens({
  authToken: result.token,
  token: result.token,
  refreshToken: result.refreshToken,        // NEW
  expiresIn: result.expiresIn,             // NEW
  refreshExpiresIn: result.refreshExpiresIn, // NEW
  deviceId: result.deviceId,
  user: { email: result.user.email }
});

// Same changes in authorizePIN()
```

## 📦 Storage Structure

The app now stores the following in AsyncStorage:

| Key | Value | Description |
|-----|-------|-------------|
| `authToken` | JWT string | Access token (1 hour expiry) |
| `refreshToken` | JWT string | Refresh token (90 days expiry) |
| `tokenExpiry` | Timestamp (ms) | When access token expires |
| `refreshTokenExpiry` | Timestamp (ms) | When refresh token expires |
| `deviceId` | UUID string | Device identifier |
| `userEmail` | Email string | User's email |
| `isDeviceAuthorized` | 'true'/'false' | Device authorization status |
| `authMethod` | 'device'/'pin'/'firebase' | Authentication method used |

## 🔄 Token Refresh Flow

### Current Implementation

1. **On Login (QR/PIN)**:
   - Backend generates access token (1h) + refresh token (90d)
   - Mobile app stores both tokens with expiry timestamps
   
2. **On App Startup**:
   - App calls `validateDeviceAuth()`
   - Backend checks if access token is still valid
   - If expired, backend uses refresh token to generate new access token
   - Mobile app updates access token and expiry timestamp

3. **Token Storage**:
   - Tokens stored in both AsyncStorage and SecureStore
   - Expiry timestamps stored in AsyncStorage for easy checking

### Enhanced Features (ALL COMPLETED ✅)

The following enhancements have been fully implemented:

1. ✅ **Task 1: Call validateDeviceAuth on App Startup** - Refresh token when app opens
2. ✅ **Task 2: AppState Listener** - Refresh token when app comes to foreground
3. ✅ **Task 3: Lazy Refresh** - Check token expiry before API calls
4. ✅ **Task 4: 401 Error Handler** - Retry with token refresh on authentication errors

See the "Implementation Details" section below for complete code.

---

## 🚧 Pending Tasks

### Task 1: Update AuthContext to Call validateDeviceAuth ✅

**Status:** COMPLETED
**Priority:** HIGH - Required for token refresh to work

**What Was Changed:**
The `checkExistingAuth()` function in `context/AuthContext.tsx` (lines 183-213) has been updated to call `validateDeviceAuth()` instead of skipping validation.

**Implementation:**

```typescript
// File: context/AuthContext.tsx (lines 183-213)
if (isDeviceAuthorized) {
  console.log('✅ [AUTH] Device is authorized, validating and refreshing token if needed...');

  // REFRESH TOKEN MECHANISM: Call validateDeviceAuth to refresh token if expired
  // This ensures permanent login even after access token expires (up to 90 days)
  try {
    const validationResult = await ApiService.validateDeviceAuth();

    if (validationResult.success && validationResult.user) {
      console.log('✅ [AUTH] Device validation successful, user:', validationResult.user.email);
      setUser({
        email: validationResult.user.email,
        authMethod: 'device',
        deviceAuthorized: true,
      });
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    } else {
      console.log('❌ [AUTH] Device validation failed:', validationResult.message);
      console.log('🧹 [AUTH] Clearing device auth due to validation failure');
      await ApiService.clearDeviceAuth();
    }
  } catch (error) {
    console.error('❌ [AUTH] Error during device validation:', error);
    console.log('🧹 [AUTH] Clearing device auth due to error');
    await ApiService.clearDeviceAuth();
  }
}
```

**Benefits:**
- ✅ Token automatically refreshed when app opens (even after 24 hours)
- ✅ User stays logged in for up to 90 days
- ✅ Proper error handling with auth cleanup on failure
- ✅ Detailed logging for debugging

### Task 2: Add AppState Listener for Auto-Refresh ✅

**Status:** COMPLETED
**Priority:** MEDIUM - Improves user experience

**Purpose:** Automatically refresh token when app comes to foreground (user opens app after it was in background).

**Implementation:** ✅ COMPLETED

File: `context/AuthContext.tsx` (lines 254-295)

```typescript
// AppState listener added to AuthProvider component
useEffect(() => {
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && isAuthenticated) {
      const authMethod = await AsyncStorage.getItem('authMethod');

      if (authMethod === 'device' || authMethod === 'pin') {
        console.log('📱 [APP-STATE] Device/PIN auth detected, refreshing token...');
        const result = await ApiService.validateDeviceAuth();

        if (result.success) {
          console.log('✅ [APP-STATE] Token refresh successful');
        }
      }
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}, [isAuthenticated]);
```

**Benefits:**
- ✅ Token refreshed automatically when app returns to foreground
- ✅ Prevents 401 errors after app was in background for extended time
- ✅ Only applies to device/PIN auth (not Firebase)

### Task 3: Add Lazy Refresh Before API Calls ✅

**Status:** COMPLETED
**Priority:** MEDIUM - Prevents API call failures

**Purpose:** Check if token is about to expire before making API calls and refresh proactively.

**Implementation:** ✅ COMPLETED

File: `services/api.ts` (lines 615-645)

```typescript
// Added to authenticatedRequest() function
static async authenticatedRequest(endpoint: string, options: any = {}, retryCount: number = 0) {
  try {
    // Check if token is about to expire (within 5 minutes)
    const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
    const authMethod = await AsyncStorage.getItem('authMethod');

    if (tokenExpiry && (authMethod === 'device' || authMethod === 'pin')) {
      const expiryTime = parseInt(tokenExpiry);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (now >= expiryTime - fiveMinutes) {
        console.log('⏰ [AUTH-REQ] Token expiring soon, refreshing proactively...');

        const refreshResult = await this.validateDeviceAuth();
        if (refreshResult.success) {
          console.log('✅ [AUTH-REQ] Token refreshed successfully before API call');
        }
      } else {
        const minutesUntilExpiry = Math.floor((expiryTime - now) / 60000);
        console.log(`⏰ [AUTH-REQ] Token valid for ${minutesUntilExpiry} more minutes`);
      }
    }

    // Continue with API call...
  }
}
```

**Benefits:**
- ✅ Prevents 401 errors by refreshing token before it expires
- ✅ 5-minute buffer ensures smooth operation
- ✅ Logs time until expiry for debugging
- ✅ Only applies to device/PIN auth

### Task 4: Add 401 Error Handler with Retry ✅

**Status:** COMPLETED
**Priority:** LOW - Safety net for edge cases

**Purpose:** Automatically retry API calls with token refresh when receiving 401 errors.

**Implementation:** ✅ COMPLETED

File: `services/api.ts` (lines 663-705)

```typescript
// Enhanced 401 error handling in authenticatedRequest()
if (response.status === 401 || response.status === 403) {
  console.log(`❌ [AUTH-REQ] UNAUTHORIZED (${response.status})`);
  console.log(`❌ [AUTH-REQ] Retry count: ${retryCount}`);

  // Only retry once to avoid infinite loops
  if (retryCount === 0) {
    const authMethod = await AsyncStorage.getItem('authMethod');

    // Only attempt refresh for device/PIN auth (not Firebase)
    if (authMethod === 'device' || authMethod === 'pin') {
      console.log('🔄 [AUTH-REQ] Attempting token refresh after 401 error...');

      const refreshResult = await this.validateDeviceAuth();

      if (refreshResult.success) {
        console.log('✅ [AUTH-REQ] Token refreshed successfully, retrying request...');
        // Retry the request with the new token
        return this.authenticatedRequest(endpoint, options, retryCount + 1);
      }
    }
  }

  // If refresh failed or not applicable - clear auth
  console.log(`❌ [AUTH-REQ] CLEARING TOKEN after failed refresh attempt`);
  await clearTokenAuth();
  if (this.authErrorHandler) this.authErrorHandler();
  throw new Error('Unauthorized');
}
```

**Benefits:**
- ✅ Automatically retries failed requests after token refresh
- ✅ Prevents infinite retry loops (max 1 retry)
- ✅ Safety net for edge cases not covered by Task 2-3
- ✅ Seamless user experience - no manual intervention needed

---

## 🧪 Testing Checklist

Before deploying to production, test the following scenarios:

- [ ] **QR Code Login**
  - [ ] Verify refresh token is stored in AsyncStorage
  - [ ] Verify token expiry timestamps are calculated correctly
  - [ ] Check console logs for token expiry dates

- [ ] **PIN Login**
  - [ ] Verify refresh token is stored in AsyncStorage
  - [ ] Verify token expiry timestamps are calculated correctly
  - [ ] Check console logs for token expiry dates

- [ ] **App Restart**
  - [ ] Close and reopen app
  - [ ] Verify user stays logged in
  - [ ] Check if `validateDeviceAuth()` is called (after Task 1 is completed)

- [ ] **Token Refresh**
  - [ ] Wait for access token to expire (or manually set expired timestamp)
  - [ ] Verify new token is received from backend
  - [ ] Verify token expiry timestamp is updated

- [ ] **Refresh Token Expiry**
  - [ ] Manually set refresh token as expired in database
  - [ ] Verify user is logged out
  - [ ] Verify user is redirected to login screen

- [ ] **Web Authentication**
  - [ ] Verify Firebase login still works
  - [ ] Verify web app is not affected by mobile changes

---

## ⚠️ Important Notes

1. **Backend Must Be Updated First**: The backend changes in `REFRESH_TOKEN_IMPLEMENTATION_BACKEND.md` must be deployed before these mobile changes will work.

2. **Backward Compatibility**: Existing mobile devices without refresh tokens will continue to work, but they'll need to re-login after their current token expires.

3. **Web App Not Affected**: These changes only affect mobile device authentication (QR/PIN). Web authentication continues to use Firebase ID tokens and cookies.

4. **Task 1 is Critical**: Without completing Task 1 (updating AuthContext to call validateDeviceAuth), the token refresh mechanism won't work on app startup.

5. **Token Expiry Defaults**: If backend doesn't send `expiresIn` values, the app uses defaults:
   - Access token: 1 hour (3600 seconds)
   - Refresh token: 90 days (7,776,000 seconds)

---

## 📝 Files Modified (ALL COMPLETED ✅)

- ✅ `services/api.ts` - Updated type definitions, authorization functions, token storage, validation, lazy refresh, and 401 error handling
- ✅ `context/AuthContext.tsx` - Updated QR/PIN authorization, added validateDeviceAuth call on startup, and AppState listener
- 📄 `REFRESH_TOKEN_IMPLEMENTATION_MOBILE.md` - This documentation file

## 🎯 Implementation Summary

**ALL TASKS COMPLETED:**
- ✅ Task 1: Call `validateDeviceAuth()` on app startup (lines 183-213 in AuthContext.tsx)
- ✅ Task 2: AppState listener for foreground refresh (lines 254-295 in AuthContext.tsx)
- ✅ Task 3: Lazy refresh before API calls (lines 615-645 in api.ts)
- ✅ Task 4: 401 error handler with retry (lines 663-705 in api.ts)


