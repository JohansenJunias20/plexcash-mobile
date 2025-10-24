# 🚀 Quick Fix: Google OAuth "Access Blocked" Error

## ⚡ TL;DR - Fast Solution

Your error: **"Access blocked: This app doesn't comply with Google's OAuth 2.0 policy"**

**Root cause**: The redirect URI is not configured in Google Cloud Console.

---

## 🔧 Quick Fix (5 minutes)

### **Step 1: Get Redirect URI** (1 minute)

1. Open your Expo app on your phone (or restart if needed)
2. Tap "Login with Google Account"
3. An alert will show the redirect URI - **COPY IT EXACTLY**
4. It will look like: `exp://yuduma4-johansenjunias-8081.exp.direct`

**Important**: Yes, the `exp://` URI is correct! Google OAuth DOES accept these URIs.

**Alternative**: Check the console logs in your terminal for the redirect URI.

---

### **Step 2: Add to Google Cloud Console** (2 minutes)

1. Go to: https://console.cloud.google.com/
2. Select project: **plex-seller-id**
3. Navigate to: **APIs & Services** > **Credentials**
4. Find and click: `227685404880-gqldg2ug3jdsf75tqkde8n4h4a2taflv.apps.googleusercontent.com`
5. Click **Edit** (pencil icon)
6. Scroll to **Authorized redirect URIs**
7. Click **+ ADD URI**
8. Paste the redirect URI from Step 1
9. Click **SAVE**

---

### **Step 3: Add Test User** (1 minute)

1. In Google Cloud Console, go to: **APIs & Services** > **OAuth consent screen**
2. Scroll to **Test users**
3. Click **+ ADD USERS**
4. Add your Gmail address (the one you're testing with)
5. Click **SAVE**

---

### **Step 4: Wait & Test** (1 minute)

1. **Wait 5-10 minutes** for Google's changes to propagate
2. **Restart your Expo app**:
   ```bash
   # Press Ctrl+C to stop
   npm start
   ```
3. **Clear Expo Go cache** on your phone:
   - Close Expo Go completely
   - Reopen and reload the app
4. **Try logging in again**

---

## ✅ Success Checklist

Before testing, make sure:

- [ ] Redirect URI copied from app alert
- [ ] Redirect URI added to Google Cloud Console > Credentials
- [ ] Your email added as test user in OAuth consent screen
- [ ] Waited 5-10 minutes after saving changes
- [ ] Expo app restarted
- [ ] Expo Go cache cleared

---

## 🎯 Expected Redirect URI

Your redirect URI will look like:

```
exp://yuduma4-johansenjunias-8081.exp.direct
```

**Important Notes:**
- ✅ Yes, `exp://` URIs are valid and accepted by Google OAuth
- ✅ The URI changes each time you restart Expo (this is normal in development)
- ✅ You need to add the EXACT URI shown in your app to Google Cloud Console
- ⚠️ If you restart Expo, the URI might change and you'll need to update it in Google Cloud Console

---

## 🚨 Still Not Working?

### Common Issues:

**1. "Access blocked" still appears**
- ✅ Make sure you added your email as a **test user**
- ✅ Wait 10-15 minutes (Google can be slow)
- ✅ Try with the exact email you added as test user

**2. "redirect_uri_mismatch"**
- ✅ The URI in Google Cloud Console must match EXACTLY
- ✅ Check for typos, extra spaces, or wrong protocol (https vs http)
- ✅ Copy the URI from the app alert, don't type it manually

**3. "invalid_client"**
- ✅ Check that the Client ID in `services/googleAuth.ts` is correct
- ✅ Verify it matches the one in Google Cloud Console

---

## 📋 Full Configuration Checklist

### Google Cloud Console - OAuth Consent Screen

```
✅ User Type: External
✅ App name: Plex Seller Mobile
✅ User support email: [YOUR_EMAIL]
✅ Scopes: email, profile, openid
✅ Test users: [YOUR_EMAIL] added
✅ Publishing status: Testing (for development)
```

### Google Cloud Console - Credentials

```
✅ OAuth 2.0 Client ID: 227685404880-gqldg2ug3jdsf75tqkde8n4h4a2taflv.apps.googleusercontent.com
✅ Authorized redirect URIs:
   - exp://yuduma4-johansenjunias-8081.exp.direct (your exact URI from the app)
   - http://localhost:19000 (optional, for web testing)
   - http://127.0.0.1:19000 (optional, for web testing)
```

---

## 🔍 Debugging

### Check Console Logs

When you tap "Login with Google Account", check your terminal for:

```
===========================================
IMPORTANT: Copy this Redirect URI:
Redirect URI: https://auth.expo.io/@anonymous/plexcash-mobile
===========================================
```

This is the EXACT URI you need to add to Google Cloud Console.

### Check App Alert

The app will show an alert with the redirect URI. Copy it from there.

---

## 📞 Need More Help?

See the detailed guide: **FIX_GOOGLE_OAUTH_ERROR.md**

---

## 🎉 Success!

After completing these steps, you should be able to:

1. ✅ Tap "Login with Google Account"
2. ✅ See Google account selection screen
3. ✅ Select your account
4. ✅ Grant permissions
5. ✅ Return to app successfully authenticated

---

## 💡 Pro Tips

1. **Always add your email as a test user** when the app is in "Testing" mode
2. **Wait 10-15 minutes** after making changes in Google Cloud Console
3. **Clear Expo Go cache** by closing and reopening the app
4. **Check console logs** for the exact redirect URI
5. **Use the exact email** you added as a test user

Good luck! 🚀

