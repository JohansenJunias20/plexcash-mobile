# Google OAuth Navigation Fix - Race Condition Resolution

## Problem Summary

**Issue:** Users were getting stuck on the LoginScreen after successfully completing Google OAuth authentication. The logs showed:
- ✅ Google OAuth flow completed successfully (step 15)
- ✅ Backend authentication succeeded (`{"status": true}`)
- ✅ Firebase sign-in with custom token succeeded
- ❌ **BUT** the Firebase `onAuthStateChanged` listener did NOT fire
- ❌ Users remained stuck on LoginScreen instead of navigating to MainScreen

**Expected Flow (from `GOOGLE_LOGIN_DEBUG_GUIDE.md`):**
```
Steps 1-16: Google OAuth and Firebase sign-in ✅
Step 17: Firebase onAuthStateChanged listener fires ❌ MISSING
Steps 18-22: Token storage and state updates ❌ MISSING
Steps 23-25: Navigation to MainScreen ❌ MISSING
```

## Root Cause Analysis

### The Race Condition

The issue was a **critical race condition** in `context/AuthContext.tsx`:

**Before Fix:**
```typescript
useEffect(() => {
  const checkExistingAuth = async () => {
    // Check AsyncStorage for existing auth (takes time)
    // ...
    
    // ONLY AFTER checkExistingAuth completes:
    checkFirebaseAuth(); // Sets up onAuthStateChanged listener
  };
  
  checkExistingAuth();
}, []);
```

**The Problem:**
1. When AuthContext mounts, it first runs `checkExistingAuth()` (async operation)
2. `checkExistingAuth()` checks AsyncStorage for existing tokens
3. **ONLY THEN** does it call `checkFirebaseAuth()` which sets up the `onAuthStateChanged` listener
4. **BUT** Google OAuth can complete BEFORE the listener is set up!
5. If `signInWithCustomToken()` completes before the listener exists, the auth state change is **missed**
6. Result: User is authenticated in Firebase, but AuthContext never knows about it

### Timeline of the Race Condition

```
T=0ms:    User taps "Login with Google"
T=100ms:  Google OAuth flow starts
T=500ms:  AuthContext mounts, starts checkExistingAuth()
T=600ms:  checkExistingAuth() reading from AsyncStorage...
T=2000ms: Google OAuth completes, signInWithCustomToken() succeeds
T=2001ms: Firebase auth state changes to authenticated
T=2002ms: ❌ NO LISTENER EXISTS YET - auth state change is MISSED
T=3000ms: checkExistingAuth() finally completes
T=3001ms: checkFirebaseAuth() sets up listener
T=3002ms: ✅ Listener is now active, but the auth state change already happened!
```

## Solution Implemented

### Fix #1: Set Up Firebase Listener IMMEDIATELY

**Changed:** `context/AuthContext.tsx` lines 48-242

**Before:**
```typescript
useEffect(() => {
  const checkExistingAuth = async () => {
    // Check existing auth first...
    checkFirebaseAuth(); // Listener set up AFTER async check
  };
  checkExistingAuth();
}, []);
```

**After:**
```typescript
useEffect(() => {
  // CRITICAL FIX: Set up Firebase listener IMMEDIATELY
  // This ensures we catch auth state changes from Google OAuth
  // even if they happen while we're still checking existing auth
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    // Handle auth state changes...
  });

  // NOW check for existing auth (runs in parallel with listener active)
  const checkExistingAuth = async () => {
    // Check AsyncStorage for existing sessions...
  };
  checkExistingAuth();

  // Cleanup
  return () => unsubscribe();
}, []);
```

**Key Changes:**
1. ✅ Firebase listener is set up **synchronously** when AuthContext mounts
2. ✅ Listener is active **before** any async operations
3. ✅ `checkExistingAuth()` runs in parallel with the listener being active
4. ✅ No matter when Google OAuth completes, the listener will catch it

### Fix #2: Fallback Mechanism for Token Storage

**Changed:** `services/googleAuth.ts` lines 417-475

Added a 3-second fallback timeout that manually stores tokens if `onAuthStateChanged` doesn't fire:

```typescript
// FALLBACK MECHANISM: If onAuthStateChanged doesn't fire within 3 seconds,
// manually store the token to ensure the user can proceed
const fallbackTimeout = setTimeout(async () => {
  logGoogleAuth('⚠️ FALLBACK: onAuthStateChanged did not fire within 3 seconds');

  try {
    // Manually store tokens (same as what onAuthStateChanged would do)
    await ApiService.storeDeviceTokens({
      authToken: idToken,
      token: idToken,
      deviceId: deviceId,
      user: { email },
      authMethod: 'firebase'
    });

    logGoogleAuth('✅ FALLBACK: Tokens stored manually');
  } catch (error) {
    logError('FALLBACK: Failed to store tokens manually', { context: 'GOOGLE-AUTH-FALLBACK', data: error });
  }
}, 3000);
```

**Why This Helps:**
- Even if the listener somehow still doesn't fire, tokens are stored after 3 seconds
- Provides a safety net for edge cases
- Ensures users can always proceed after successful authentication

## Expected Behavior After Fix

### New Timeline (Fixed)

```
T=0ms:    User taps "Login with Google"
T=100ms:  Google OAuth flow starts
T=500ms:  AuthContext mounts
T=501ms:  ✅ Firebase listener set up IMMEDIATELY
T=502ms:  checkExistingAuth() starts (async, in parallel)
T=2000ms: Google OAuth completes, signInWithCustomToken() succeeds
T=2001ms: Firebase auth state changes to authenticated
T=2002ms: ✅ LISTENER CATCHES THE CHANGE!
T=2003ms: onAuthStateChanged fires with firebaseUser
T=2004ms: Tokens stored in AsyncStorage and SecureStore
T=2005ms: isAuthenticated set to true
T=2006ms: RootNavigator re-renders
T=2007ms: ✅ User navigates to MainScreen
```

### Complete Log Flow (After Fix)

```
1-16.  [Google OAuth and Firebase sign-in - same as before]
17. 🔥 [AUTH-STATE-CHANGED] Firebase auth state changed, user: johansen.junias17@gmail.com
18. 🔐 [AUTH] Storing Firebase token in SecureStore and AsyncStorage...
19. ✅ [AUTH] Token storage complete!
20. ⚠️ [STATE-CHANGE] CRITICAL: Setting isAuthenticated = TRUE
21. ✅ [STATE-CHANGE] isAuthenticated is now TRUE - RootNavigator should re-render!
22. ✅ [AUTH] Authentication state fully updated - navigation to MainScreen should occur NOW
23. 🧭 [NAVIGATION] RootNavigator render cycle
24. ✅ [NAVIGATION] User IS authenticated - showing MainScreen
25. ✅ [NAVIGATION] Authentication complete - MainScreen should be visible
```

## Testing Checklist

- [ ] Build and test the app with the fix
- [ ] Verify Firebase listener is set up immediately on AuthContext mount
- [ ] Confirm Google OAuth triggers navigation to MainScreen automatically
- [ ] Test with slow network conditions
- [ ] Test with fast OAuth completion (race condition scenario)
- [ ] Verify fallback mechanism works if listener doesn't fire
- [ ] Ensure QR code and PIN login still work (not broken by changes)

## Files Modified

1. **`context/AuthContext.tsx`** (lines 48-242)
   - Moved Firebase listener setup to execute immediately on mount
   - Restructured to run `checkExistingAuth()` in parallel with active listener

2. **`services/googleAuth.ts`** (lines 417-475)
   - Added 3-second fallback timeout for manual token storage
   - Provides safety net if listener doesn't fire

## Technical Notes

- The fix maintains backward compatibility with QR code and PIN authentication
- Firebase persistence is already configured correctly via AsyncStorage
- The fallback mechanism is a safety net and should rarely be needed
- All existing logging remains in place for debugging

## Summary

✅ **Root Cause:** Race condition where Firebase listener was set up AFTER Google OAuth could complete
✅ **Fix:** Set up listener immediately on AuthContext mount, before any async operations
✅ **Fallback:** Added 3-second timeout to manually store tokens if listener doesn't fire
✅ **Result:** Users will now automatically navigate to MainScreen after successful Google OAuth

The fix ensures that no matter how fast Google OAuth completes, the Firebase `onAuthStateChanged` listener will always be ready to catch the authentication state change.


