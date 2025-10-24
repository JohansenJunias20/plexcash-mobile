# 🚀 Google OAuth Setup - Final Instructions

## ✅ **Current Status**

- ✅ Web Client ID configured: `227685404880-cdk3pq80i0d91si864gaakka214tg34l.apps.googleusercontent.com`
- ✅ Code updated to use Web Client ID (not Android Client ID)
- ⏳ Need to add redirect URI to Google Cloud Console

---

## 📋 **Step-by-Step Instructions**

### **Step 1: Restart Your Expo App**

```bash
# Stop the current app (Ctrl+C)
npm start -- --clear
```

### **Step 2: Get the Redirect URI**

1. Open the app on your phone
2. Tap "Login with Google Account"
3. Copy the redirect URI from the alert or console logs
4. It should now look like one of these:
   ```
   https://auth.expo.io/@anonymous/plexcash-mobile
   https://auth.expo.io/@YOUR_USERNAME/plexcash-mobile
   ```

**Important**: It should start with `https://` (not `exp://`)

---

### **Step 3: Add Redirect URI to Google Cloud Console**

1. Go to: https://console.cloud.google.com/
2. Select project: **plex-seller-id**
3. Navigate to: **APIs & Services** > **Credentials**
4. Find the **Web application** OAuth client (NOT the Android one)
5. Click **Edit** (pencil icon)
6. Under **Authorized redirect URIs**, click **+ ADD URI**
7. Add the redirect URI from Step 2 (the `https://auth.expo.io/...` one)
8. **Also add these backup URIs**:
   ```
   https://auth.expo.io/@anonymous/plexcash-mobile
   https://auth.expo.io/plexcash-mobile
   http://localhost:19000
   ```
9. Click **SAVE**

---

### **Step 4: Configure OAuth Consent Screen**

1. In Google Cloud Console, go to: **APIs & Services** > **OAuth consent screen**
2. Make sure these are configured:

   **User Type**: External (or Internal if using Google Workspace)
   
   **Scopes**: Add these scopes:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `openid`

3. **Add Test Users** (IMPORTANT!):
   - Scroll to **Test users** section
   - Click **+ ADD USERS**
   - Add your Gmail address (the one you'll use for testing)
   - Click **SAVE**

---

### **Step 5: Wait & Test**

1. **Wait 5-10 minutes** for Google's changes to propagate
2. **Restart Expo app**:
   ```bash
   npm start
   ```
3. **Clear Expo Go cache** on your phone:
   - Close Expo Go completely
   - Reopen and reload the app
4. **Try logging in** with Google

---

## 🎯 **Expected Behavior**

After completing these steps:

1. ✅ Tap "Login with Google Account"
2. ✅ Browser opens with Google account selection
3. ✅ Select your Google account
4. ✅ Grant permissions
5. ✅ Return to app successfully authenticated

---

## 🚨 **Troubleshooting**

### **Issue: Still getting `exp://` redirect URI**

**Solution**: The app might not be using Expo's auth proxy. Try:
1. Make sure you restarted Expo with `--clear` flag
2. Check that you're using the Web Client ID (not Android)
3. The redirect URI should be `https://auth.expo.io/...`

### **Issue: "Access blocked" error**

**Solution**: 
- Make sure you added your email as a **test user** in OAuth consent screen
- Wait 10-15 minutes for changes to propagate
- Use the exact email you added as test user

### **Issue: "redirect_uri_mismatch" error**

**Solution**:
- The redirect URI in Google Cloud Console doesn't match
- Copy the EXACT URI from the app alert
- Make sure you're editing the **Web** client (not Android)

### **Issue: "invalid_client" error**

**Solution**:
- Verify the Web Client ID is correct in `services/googleAuth.ts`
- Should be: `227685404880-cdk3pq80i0d91si864gaakka214tg34l.apps.googleusercontent.com`

---

## 📝 **Summary of Changes Made**

### **Updated Files:**

1. **services/googleAuth.ts**:
   - Changed from Android Client ID to Web Client ID
   - Updated to use proper redirect URI generation
   - Added better logging and alerts

### **What You Need to Do:**

1. ✅ Restart Expo app
2. ✅ Get the `https://` redirect URI
3. ✅ Add it to **Web** OAuth client in Google Cloud Console
4. ✅ Add your email as test user
5. ✅ Wait 10 minutes and test

---

## 🔑 **Key Points to Remember**

- ✅ Use **Web Client ID** (not Android Client ID)
- ✅ Redirect URI must be `https://` (not `exp://`)
- ✅ Edit the **Web application** OAuth client (not Android)
- ✅ Add your email as **test user** in OAuth consent screen
- ✅ Wait 10 minutes after making changes

---

## 📞 **Still Having Issues?**

If you're still getting errors:

1. **Check console logs** for the exact redirect URI
2. **Verify you're editing the Web client** (not Android)
3. **Confirm test user email** matches the account you're testing with
4. **Wait 15 minutes** after making changes in Google Cloud Console

Good luck! 🚀

