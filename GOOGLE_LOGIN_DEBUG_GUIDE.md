# Google Login Debug Guide

## Problem Statement

The Google login flow in the Android APK build was experiencing an issue where:
- Google login appeared to succeed
- However, the app didn't automatically navigate to MainScreen.tsx
- The user had to manually refresh the app before it would navigate to MainScreen.tsx
- This issue only occurred in production APK builds, not in development mode

## Root Cause Analysis

The issue was likely caused by one or more of the following:

1. **Console logs stripped in production**: React Native production builds may strip `console.log` statements, making debugging impossible
2. **State update race condition**: The authentication state (`isAuthenticated`) might not have been triggering a re-render in the RootNavigator
3. **Async state propagation**: In production builds, React Native may batch state updates differently than in development

## Solution Implemented

### 1. Production-Safe Logger (`utils/logger.ts`)

Created a comprehensive logging utility that works in both development and production builds:

**Features:**
- ✅ Uses multiple console methods (`console.log`, `console.info`, `console.warn`, `console.error`) to bypass production stripping
- ✅ Adds timestamps and context to all logs
- ✅ Buffers logs for later retrieval
- ✅ Supports different log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
- ✅ Specialized logging methods for auth, navigation, and Google auth flows

**Usage:**
```typescript
import { logAuth, logNavigation, logGoogleAuth, logError } from '../utils/logger';

logAuth('User authenticated successfully', { email: 'user@example.com' });
logNavigation('Navigating to MainScreen');
logGoogleAuth('Step 1: Getting device ID...');
logError('Authentication failed', { context: 'AUTH', data: error });
```

### 2. Comprehensive Logging in Google Auth Flow

Added detailed logging throughout `services/googleAuth.ts`:

**Logged Steps:**
1. ✅ Configuration validation
2. ✅ Device ID generation
3. ✅ Backend session initialization
4. ✅ Browser OAuth flow
5. ✅ Redirect URL parsing
6. ✅ Session verification
7. ✅ Firebase sign-in
8. ✅ Backend token exchange
9. ✅ Success/error states

**Example logs you'll see:**
```
🚀 [GOOGLE-AUTH] Starting Google Sign-In flow...
📱 [GOOGLE-AUTH] Step 1: Getting device ID...
✅ [GOOGLE-AUTH] Device ID obtained
🔐 [GOOGLE-AUTH] Step 2: Initializing auth session with backend...
...
✅ [GOOGLE-AUTH] Backend authentication successful!
⚠️ [GOOGLE-AUTH] IMPORTANT: onAuthStateChanged listener should fire now...
```

### 3. Enhanced AuthContext Logging

Added comprehensive logging to `context/AuthContext.tsx`:

**Logged Events:**
- ✅ Firebase auth state changes
- ✅ Token storage operations
- ✅ State updates (`isAuthenticated`, `isLoading`, `user`)
- ✅ Navigation triggers

**Example logs:**
```
🔥 [AUTH] Firebase auth state changed!
🔐 [AUTH] Storing Firebase token in SecureStore and AsyncStorage...
⚠️ [STATE-CHANGE] CRITICAL: Setting isAuthenticated = TRUE
✅ [AUTH] Authentication state fully updated - navigation to MainScreen should occur NOW
```

### 4. RootNavigator Logging

Added logging to `navigation/RootNavigator.tsx`:

**Logged Events:**
- ✅ Every render cycle
- ✅ Authentication state checks
- ✅ Screen transitions (Loading → Login → MainScreen)

**Example logs:**
```
🧭 [NAVIGATION] RootNavigator render cycle
⏳ [NAVIGATION] Showing loading screen
✅ [NAVIGATION] User IS authenticated - showing MainScreen
```

### 5. Force Re-render Mechanism

Implemented a mechanism to ensure the RootNavigator re-renders after authentication:

**Changes:**
1. Added `useEffect` hook in RootNavigator that tracks `isAuthenticated`, `isLoading`, and `user` changes
2. Added a 100ms delayed state confirmation in AuthContext to force re-render
3. Ensured AsyncStorage is updated BEFORE setting `isAuthenticated = true`

**Code:**
```typescript
// In AuthContext.tsx
setIsAuthenticated(true);

// Force re-render after small delay
setTimeout(() => {
  setIsAuthenticated(true);
  logAuth('✅ Authentication state confirmed');
}, 100);
```

## How to Debug Google Login Issues

### Step 1: Build and Install APK

```bash
# Build production APK
eas build --platform android --profile production

# Or build locally
npx expo run:android --variant release
```

### Step 2: View Logs in Real-Time

**Option A: Using Android Studio Logcat**
1. Open Android Studio
2. Go to View → Tool Windows → Logcat
3. Connect your Android device or start emulator
4. Filter by package name: `com.plexcash.mobile`
5. Look for logs with emojis: 🚀, 🔥, ✅, ❌, ⚠️

**Option B: Using ADB (Android Debug Bridge)**
```bash
# View all logs
adb logcat

# Filter for your app
adb logcat | grep "com.plexcash.mobile"

# Filter for specific contexts
adb logcat | grep "GOOGLE-AUTH"
adb logcat | grep "AUTH"
adb logcat | grep "NAVIGATION"
```

**Option C: Using React Native Debugger**
```bash
# For development builds
npx react-native log-android
```

### Step 3: Analyze the Log Flow

When Google login is triggered, you should see this sequence:

```
1. 🚀 [GOOGLE-AUTH] Starting Google Sign-In flow...
2. 📱 [GOOGLE-AUTH] Step 1: Getting device ID...
3. ✅ [GOOGLE-AUTH] Device ID obtained
4. 🔐 [GOOGLE-AUTH] Step 2: Initializing auth session with backend...
5. ✅ [GOOGLE-AUTH] Session initialized successfully
6. 🌐 [GOOGLE-AUTH] Step 3: Opening browser for Google OAuth...
7. ✅ [GOOGLE-AUTH] Browser closed
8. 📋 [GOOGLE-AUTH] Step 4: Parsing redirect URL...
9. ✅ [GOOGLE-AUTH] Session ID extracted from redirect
10. 🔍 [GOOGLE-AUTH] Step 5: Verifying session with backend...
11. ✅ [GOOGLE-AUTH] Custom Firebase token received
12. 🔥 [GOOGLE-AUTH] Step 6: Signing in to Firebase with custom token...
13. ✅ [GOOGLE-AUTH] Firebase sign-in successful!
14. 🔄 [GOOGLE-AUTH] Step 7: Exchanging Firebase ID token with backend...
15. ✅ [GOOGLE-AUTH] Backend authentication successful!
16. ⚠️ [GOOGLE-AUTH] IMPORTANT: onAuthStateChanged listener should fire now...

--- AuthContext receives the auth state change ---

17. 🔥 [AUTH] Firebase auth state changed!
18. 🔐 [AUTH] Storing Firebase token in SecureStore and AsyncStorage...
19. ✅ [AUTH] Token storage complete!
20. ⚠️ [STATE-CHANGE] CRITICAL: Setting isAuthenticated = TRUE
21. ✅ [STATE-CHANGE] isAuthenticated is now TRUE - RootNavigator should re-render!
22. ✅ [AUTH] Authentication state fully updated - navigation to MainScreen should occur NOW

--- RootNavigator re-renders ---

23. 🧭 [NAVIGATION] RootNavigator render cycle
24. ✅ [NAVIGATION] User IS authenticated - showing MainScreen
25. ✅ [NAVIGATION] Authentication complete - MainScreen should be visible
```

### Step 4: Identify Issues

**If navigation doesn't happen, check:**

1. **Did step 16 occur?** If not, Firebase sign-in failed
2. **Did step 17 occur?** If not, `onAuthStateChanged` listener didn't fire
3. **Did step 21 occur?** If not, state update failed
4. **Did step 24 occur?** If not, RootNavigator didn't re-render

**Common issues:**

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Logs stop at step 16 | `onAuthStateChanged` not firing | Check Firebase configuration |
| Logs reach step 21 but no step 24 | RootNavigator not re-rendering | Check React Navigation setup |
| No logs at all | Logger not working in production | Check if console is being stripped |
| Logs appear but navigation delayed | State propagation delay | Increase timeout in AuthContext |

## Environment Variables

Ensure these are set in your `.env` file:

```env
# Enable debug mode for production builds
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_LOG_LEVEL=debug

# Backend URL
EXPO_PUBLIC_API_BASE_URL=https://app.plexseller.com
```

## Testing Checklist

- [ ] Build production APK
- [ ] Install on physical Android device
- [ ] Open Logcat or ADB
- [ ] Trigger Google login
- [ ] Verify all 25 log steps appear
- [ ] Confirm navigation to MainScreen occurs automatically
- [ ] Test with slow network connection
- [ ] Test with 2FA enabled Google account

## Additional Notes

### Why the 100ms Delay?

In production builds, React Native may batch state updates for performance. The 100ms delay ensures:
1. AsyncStorage writes complete
2. State updates propagate to all components
3. RootNavigator receives the updated `isAuthenticated` value
4. Navigation occurs smoothly

### Why Multiple Console Methods?

Production builds may strip `console.log` but preserve `console.warn` and `console.error`. By using multiple methods, we ensure logs are visible regardless of build configuration.

### Log Buffer

The logger maintains a buffer of the last 100 log messages. You can retrieve them programmatically:

```typescript
import logger from '../utils/logger';

const logs = logger.getBufferedLogs();
console.log(logs.join('\n'));
```

## Troubleshooting

### Logs Not Appearing in Production

If you don't see any logs in production:

1. Check if Metro bundler is stripping logs:
   - Create `metro.config.js` in project root
   - Disable log stripping

2. Use `console.warn` or `console.error` instead:
   ```typescript
   console.warn('[DEBUG]', 'Your message here');
   ```

3. Use the logger's `critical` method:
   ```typescript
   logger.critical('This will always show', { showAlert: true });
   ```

### Navigation Still Not Working

If navigation still doesn't work after seeing all logs:

1. Add a manual navigation trigger in LoginScreen:
   ```typescript
   if (result.success) {
     // Force navigation after 500ms
     setTimeout(() => {
       navigation.replace('MainHome');
     }, 500);
   }
   ```

2. Check React Navigation linking configuration

3. Verify NavigationContainer is properly set up in App.tsx

## Support

If issues persist, collect the following information:

1. Full Logcat output from login attempt
2. Android version and device model
3. App version and build configuration
4. Network conditions during login

Then create an issue with this information for further investigation.

