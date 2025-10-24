# 🔧 Fix Google OAuth "Access Blocked" Error

## ❌ Error Message
```
Access blocked: Authorization Error
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy for keeping apps secure
```

## 🔍 Root Cause
This error occurs because:
1. **Web Client ID restrictions** - Using a Web Client ID that doesn't allow Expo's redirect URI pattern
2. **Missing redirect URI** - The Expo-generated redirect URI is not authorized in Google Cloud Console
3. **OAuth consent screen** - Not properly configured for testing/production

---

## ✅ Solution: Configure Google Cloud Console

### **Step 1: Get Your Redirect URI**

1. **Run the app** and tap "Login with Google Account"
2. **Copy the Redirect URI** from the alert that appears (it will look like):
   ```
   https://auth.expo.io/@anonymous/plexcash-mobile
   ```
   OR
   ```
   https://auth.expo.io/@YOUR_USERNAME/plexcash-mobile
   ```

3. **Keep this URI** - you'll need it in the next steps

---

### **Step 2: Configure OAuth Consent Screen**

1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Select Project**: `plex-seller-id`
3. **Navigate to**: APIs & Services > **OAuth consent screen**

#### **A. Basic Configuration**
```
User Type: External (or Internal if using Google Workspace)
App name: Plex Seller Mobile
User support email: [YOUR_EMAIL]
Developer contact email: [YOUR_EMAIL]
```

#### **B. Scopes**
Click **"Add or Remove Scopes"** and add:
```
../auth/userinfo.email
../auth/userinfo.profile
openid
```

#### **C. Test Users (IMPORTANT for Development)**
If your app is in "Testing" status, you MUST add test users:
1. Click **"Add Users"**
2. Add the Gmail accounts you want to test with:
   ```
   your.email@gmail.com
   another.test@gmail.com
   ```

#### **D. Publishing Status**
- **Testing**: Only test users can sign in (recommended for development)
- **In Production**: Anyone can sign in (requires Google verification)

---

### **Step 3: Configure OAuth 2.0 Client**

1. **Navigate to**: APIs & Services > **Credentials**
2. **Find your OAuth 2.0 Client**: `227685404880-gqldg2ug3jdsf75tqkde8n4h4a2taflv.apps.googleusercontent.com`
3. **Click Edit** (pencil icon)

#### **Add Authorized Redirect URIs**
Add ALL of these URIs:
```
https://auth.expo.io/@anonymous/plexcash-mobile
https://auth.expo.io/@YOUR_USERNAME/plexcash-mobile
https://auth.expo.io/plexcash-mobile
http://localhost:19000
http://127.0.0.1:19000
```

**Replace `YOUR_USERNAME`** with:
- Your actual Expo username (run `npx expo whoami` to find it)
- OR use the exact URI from Step 1

4. **Click Save**

---

### **Step 4: Verify Configuration**

After saving, verify:
- ✅ OAuth consent screen is configured
- ✅ Test users are added (if in Testing mode)
- ✅ Redirect URIs include your Expo URI
- ✅ Scopes include email, profile, openid

---

### **Step 5: Test Again**

1. **Wait 5-10 minutes** for Google's changes to propagate
2. **Restart your Expo app**:
   ```bash
   # Stop the app (Ctrl+C)
   npm start
   ```
3. **Clear app cache** on your phone:
   - Close Expo Go completely
   - Reopen Expo Go
   - Reload the app
4. **Try logging in** with Google again

---

## 🚨 Common Issues & Solutions

### Issue 1: "Access blocked" still appears
**Solution**: 
- Make sure you added your email as a **test user** in OAuth consent screen
- Wait 10-15 minutes for changes to propagate
- Try with a different Google account that's added as a test user

### Issue 2: "redirect_uri_mismatch" error
**Solution**:
- The redirect URI in Google Cloud Console doesn't match the one Expo is using
- Copy the EXACT redirect URI from the alert in Step 1
- Add it to Authorized redirect URIs in Google Cloud Console

### Issue 3: "invalid_client" error
**Solution**:
- The Client ID might be incorrect
- Verify the Client ID in `services/googleAuth.ts` matches the one in Google Cloud Console

### Issue 4: Works in Expo Go but not in standalone app
**Solution**:
- Standalone apps need a different redirect URI scheme
- You'll need to configure a custom URI scheme in `app.json`
- Consider using `expo-auth-session` with a custom scheme

---

## 📱 Alternative Solution: Use Android Client ID

If the above doesn't work, you can create a dedicated Android OAuth client:

### **Step 1: Create Android OAuth Client**

1. **Go to**: Google Cloud Console > Credentials
2. **Click**: Create Credentials > OAuth client ID
3. **Application type**: Android
4. **Package name**: `host.exp.exponent` (for Expo Go)
5. **SHA-1 certificate**: Get from Expo:
   ```bash
   npx expo credentials:manager
   ```

### **Step 2: Update googleAuth.ts**

Replace the Client ID with your new Android Client ID:
```typescript
const GOOGLE_CLIENT_ID = '227685404880-YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
```

---

## 🔐 Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data
3. **Enable only required scopes**
4. **Keep test users list minimal**
5. **Publish to production** only when ready for public use

---

## 📞 Need Help?

If you're still having issues:

1. **Check console logs** for the exact error message
2. **Verify redirect URI** matches exactly (including https://)
3. **Confirm test user** email is added in OAuth consent screen
4. **Wait 10-15 minutes** after making changes in Google Cloud Console
5. **Try incognito mode** or different Google account

---

## ✅ Success Checklist

- [ ] OAuth consent screen configured
- [ ] Test users added (your email)
- [ ] Redirect URI copied from app alert
- [ ] Redirect URI added to Google Cloud Console
- [ ] Scopes configured (email, profile, openid)
- [ ] Waited 10 minutes for changes to propagate
- [ ] App restarted
- [ ] Expo Go cache cleared
- [ ] Tested with test user account

---

## 🎯 Expected Result

After completing these steps, you should be able to:
1. Tap "Login with Google Account"
2. See Google account selection screen
3. Select your account
4. Grant permissions
5. Return to app successfully authenticated

Good luck! 🚀

