# Google 2FA Device Trust Fix

## Problem Statement

**Issue**: Google was asking for 2-Step Verification (3-digit code) on **every single login**, even from the same device that was previously verified.

**Expected Behavior**: After verifying the device once with the 3-digit code, subsequent logins from the same device should NOT require the verification code (or at least not for 30+ days).

**Root Cause**: The OAuth `prompt` parameter was set to `select_account`, which forces Google to treat every login as a fresh authentication session, bypassing device trust/remembering.

---

## Root Cause Analysis

### The Problem: `prompt=select_account`

In the original code (`services/googleAuth.ts` line 189):

```typescript
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}&` +
  `redirect_uri=${encodeURIComponent(backendCallbackUri)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent('openid profile email')}&` +
  `state=${encodeURIComponent(stateParam)}&` +
  `prompt=select_account`;  // ❌ THIS IS THE PROBLEM
```

### Why `prompt=select_account` Breaks Device Trust

According to [Google OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2/web-server#creatingclient), the `prompt` parameter controls the authentication flow:

| `prompt` Value | Behavior | Device Trust |
|----------------|----------|--------------|
| `none` | No UI shown, fails if user not authenticated | ✅ Respects device trust |
| `consent` | Always show consent screen | ❌ Forces re-authentication |
| `select_account` | Always show account picker | ❌ Forces re-authentication + 2FA |
| **OMITTED** | Google decides based on session state | ✅ **BEST for device trust** |

When `prompt=select_account` is used:
1. Google treats each login as a **new authentication session**
2. Google's device trust cookies are **ignored**
3. 2FA is **always triggered** because it looks like a new device
4. The user must verify every single time

### Why This Happens

Google's device trust mechanism works by:
1. Setting cookies in the browser after successful 2FA verification
2. Checking these cookies on subsequent logins
3. Skipping 2FA if the device is recognized

However, when `prompt=select_account` is present:
- Google **ignores** the device trust cookies
- Google **forces** the account selection screen
- This triggers the full authentication flow, including 2FA

---

## The Solution

### Change 1: Remove `prompt` Parameter

**Before:**
```typescript
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}&` +
  `redirect_uri=${encodeURIComponent(backendCallbackUri)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent('openid profile email')}&` +
  `state=${encodeURIComponent(stateParam)}&` +
  `prompt=select_account`;  // ❌ REMOVED
```

**After:**
```typescript
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}&` +
  `redirect_uri=${encodeURIComponent(backendCallbackUri)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent('openid profile email')}&` +
  `state=${encodeURIComponent(stateParam)}&` +
  `access_type=offline`;  // ✅ Added for refresh tokens
```

### Change 2: Add `access_type=offline`

Added `access_type=offline` to:
- Get refresh tokens from Google
- Enable long-term access without repeated logins
- Improve overall session management

---

## How Device Trust Works Now

### First Login (New Device)

1. User clicks "Login with Google"
2. Google shows account selection screen (first time only)
3. User selects account
4. Google asks for 2FA verification (3-digit code)
5. User enters code
6. **Google sets device trust cookies in the browser**
7. User is logged in

### Subsequent Logins (Same Device)

1. User clicks "Login with Google"
2. **Google checks device trust cookies**
3. **Device is recognized** → Skip 2FA
4. User is logged in immediately (or with minimal interaction)

### Device Trust Duration

Google's device trust typically lasts:
- **30 days** for standard accounts
- **Indefinitely** if "Don't ask again on this device" is checked
- **Until cookies are cleared** or browser data is deleted

---

## Testing the Fix

### Test Scenario 1: First Login

1. Clear browser data/cookies
2. Trigger Google login
3. **Expected**: Account selection + 2FA verification required
4. Complete login

### Test Scenario 2: Second Login (Same Device)

1. Log out from the app
2. Trigger Google login again
3. **Expected**: NO 2FA verification required
4. Login should complete quickly

### Test Scenario 3: Different Device

1. Use a different device/browser
2. Trigger Google login
3. **Expected**: 2FA verification required (new device)
4. Complete login

### Test Scenario 4: After 30 Days

1. Wait 30 days (or clear cookies)
2. Trigger Google login
3. **Expected**: 2FA verification required again
4. Device trust resets

---

## Additional Considerations

### 1. Browser Session Persistence

The device trust relies on browser cookies. In React Native, we use `WebBrowser.openAuthSessionAsync()`, which:

- ✅ Maintains cookies between sessions (on most devices)
- ✅ Shares cookies with the system browser
- ✅ Persists device trust across app restarts

**Important**: If you use `WebBrowser.openBrowserAsync()` instead, cookies may NOT persist.

### 2. Incognito/Private Mode

If the user's browser is in incognito/private mode:
- ❌ Cookies are NOT saved
- ❌ Device trust will NOT work
- ⚠️ 2FA will be required every time

### 3. Cookie Clearing

If the user clears browser data:
- ❌ Device trust cookies are deleted
- ⚠️ 2FA will be required on next login

### 4. Google Account Security Settings

Users can manage trusted devices in their Google Account:
- Go to: https://myaccount.google.com/security
- Navigate to "2-Step Verification"
- View "Devices you trust"
- Remove devices if needed

---

## When to Use Different `prompt` Values

### Use `prompt=none` (Silent Re-authentication)

```typescript
prompt=none
```

**When to use:**
- Refreshing an existing session
- Background token renewal
- User is expected to already be authenticated

**Behavior:**
- No UI shown
- Fails if user not authenticated
- Best for silent re-auth

### Use `prompt=consent` (Force Consent)

```typescript
prompt=consent
```

**When to use:**
- Requesting new permissions/scopes
- Security-critical operations
- Compliance requirements

**Behavior:**
- Always shows consent screen
- Forces re-authentication
- Ignores device trust

### Use `prompt=select_account` (Force Account Selection)

```typescript
prompt=select_account
```

**When to use:**
- Multi-account scenarios
- Allowing user to switch accounts
- Shared device environments

**Behavior:**
- Always shows account picker
- Forces re-authentication + 2FA
- Ignores device trust

### Use NO `prompt` (Recommended for Most Cases)

```typescript
// Omit prompt parameter
```

**When to use:**
- Standard login flows
- When device trust is desired
- Best user experience

**Behavior:**
- Google decides based on session state
- Respects device trust
- Shows account picker only when needed

---

## Troubleshooting

### Issue: Still Asking for 2FA Every Time

**Possible Causes:**

1. **Browser cookies not persisting**
   - Check if `WebBrowser.openAuthSessionAsync()` is used (not `openBrowserAsync()`)
   - Verify browser is not in incognito mode

2. **User clearing cookies**
   - Ask user not to clear browser data
   - Educate users about device trust

3. **Google account security settings**
   - Check if user has "Always require 2FA" enabled
   - Verify account security settings

4. **Different browser/webview each time**
   - Ensure consistent browser is used
   - Check React Native WebView configuration

### Issue: Never Asking for 2FA (Security Concern)

**Possible Causes:**

1. **2FA not enabled on Google account**
   - User needs to enable 2-Step Verification
   - Go to: https://myaccount.google.com/security

2. **Using `prompt=none`**
   - Check OAuth URL construction
   - Verify `prompt` parameter

### Issue: Account Selection Every Time (But No 2FA)

**Possible Causes:**

1. **Still using `prompt=select_account`**
   - Verify the fix was applied
   - Check deployed code

2. **Multiple Google accounts**
   - This is expected behavior
   - User can select default account

---

## Security Implications

### Is Removing `prompt=select_account` Safe?

**Yes**, removing `prompt=select_account` is safe because:

1. ✅ Google still enforces 2FA on first login from new devices
2. ✅ Device trust is a Google-managed security feature
3. ✅ Users can revoke device trust anytime
4. ✅ Device trust expires after 30 days (by default)
5. ✅ Improves user experience without compromising security

### Best Practices

1. **Trust Google's device trust mechanism** - It's battle-tested and secure
2. **Don't force re-authentication** unless necessary
3. **Use `access_type=offline`** for refresh tokens
4. **Monitor for suspicious activity** on the backend
5. **Implement session timeouts** on your backend

---

## Summary

### What Changed

- ❌ Removed `prompt=select_account` from OAuth URL
- ✅ Added `access_type=offline` for refresh tokens
- ✅ Let Google manage device trust automatically

### Expected Outcome

- ✅ First login: Account selection + 2FA verification
- ✅ Subsequent logins: NO 2FA (device is trusted)
- ✅ Better user experience
- ✅ Maintained security

### Files Modified

- `services/googleAuth.ts` (line 175-202)

---

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2/web-server)
- [OAuth 2.0 Prompt Parameter](https://developers.google.com/identity/protocols/oauth2/web-server#creatingclient)
- [Google 2-Step Verification](https://support.google.com/accounts/answer/185839)
- [Managing Trusted Devices](https://support.google.com/accounts/answer/7162782)

