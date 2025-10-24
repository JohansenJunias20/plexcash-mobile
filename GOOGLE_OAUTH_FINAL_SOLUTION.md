# 🎯 Google OAuth Final Solution

## 📋 **The Problem**

You discovered that **Expo AuthSession Proxy is deprecated** and unreliable:
- ❌ The `https://auth.expo.io/...` proxy service is deprecated
- ❌ Google rejects `exp://` URIs (requires `http://` or `https://`)
- ❌ The proxy doesn't work reliably due to browser cookie/tracking prevention

## ✅ **The Solution: Custom URL Scheme**

We've configured the app to use a **custom URL scheme** (`plexcash://redirect`) which:
- ✅ Works with Google OAuth (Google accepts custom schemes)
- ✅ Doesn't rely on deprecated Expo proxy
- ✅ More reliable and secure
- ⚠️ **Requires a development build** (won't work in Expo Go)

---

## 🚀 **Setup Instructions**

### **Step 1: Add Redirect URI to Google Cloud Console**

1. Go to: https://console.cloud.google.com/
2. Select project: **plex-seller-id**
3. Navigate to: **APIs & Services** > **Credentials**
4. Find the **Web application** OAuth client
5. Click **Edit** (pencil icon)
6. Under **Authorized redirect URIs**, click **+ ADD URI**
7. Add this URI:
   ```
   plexcash://redirect
   ```
8. Click **SAVE**

---

### **Step 2: Configure OAuth Consent Screen**

1. Go to: **APIs & Services** > **OAuth consent screen**
2. Configure:
   - **User Type**: External
   - **Scopes**: Add `email`, `profile`, `openid`
3. **Add Test Users**:
   - Click **+ ADD USERS**
   - Add your Gmail address
   - Click **SAVE**

---

### **Step 3: Build Development Build**

Since Expo Go doesn't support custom URL schemes for OAuth, you need to create a development build:

#### **For Android:**

```bash
# Install development client
npx expo install expo-dev-client

# Build for Android
npx expo run:android
```

This will:
- Install the Expo Dev Client
- Build a custom version of your app with the `plexcash://` URL scheme
- Install it on your Android device/emulator

#### **For iOS:**

```bash
# Install development client
npx expo install expo-dev-client

# Build for iOS
npx expo run:ios
```

---

### **Step 4: Test Google Login**

1. Open the development build on your device
2. Tap "Login with Google Account"
3. You should see:
   - Alert showing: `plexcash://redirect`
   - Browser opens with Google account selection
   - After selecting account, returns to app
   - Successfully authenticated!

---

## 🔧 **What Changed in the Code**

### **1. Updated `services/googleAuth.ts`:**

```typescript
// Changed from Android Client ID to Web Client ID
const GOOGLE_WEB_CLIENT_ID = '227685404880-cdk3pq80i0d91si864gaakka214tg34l.apps.googleusercontent.com';

// Added custom redirect URI
const REDIRECT_URI = 'plexcash://redirect';

// Use custom scheme instead of Expo proxy
const redirectUri = REDIRECT_URI;
```

### **2. Already configured in `app.json`:**

```json
{
  "expo": {
    "scheme": "plexcash",
    "android": {
      "package": "com.plexcash.mobile"
    },
    "ios": {
      "bundleIdentifier": "com.plexcash.mobile"
    }
  }
}
```

---

## ⚠️ **Important Notes**

### **Why Development Build is Required:**

- **Expo Go** = Generic app that can't handle custom URL schemes for OAuth
- **Development Build** = Your own app with custom URL scheme support

### **Development Build vs Expo Go:**

| Feature | Expo Go | Development Build |
|---------|---------|-------------------|
| Quick testing | ✅ Yes | ⚠️ Slower (need to rebuild) |
| Custom URL schemes | ❌ No | ✅ Yes |
| Google OAuth | ❌ Unreliable (deprecated proxy) | ✅ Reliable |
| Native modules | ❌ Limited | ✅ Full support |

---

## 🎯 **Quick Start Commands**

### **Build and Run (Android):**

```bash
# One-time setup
npx expo install expo-dev-client

# Build and run
npx expo run:android
```

### **Build and Run (iOS):**

```bash
# One-time setup
npx expo install expo-dev-client

# Build and run
npx expo run:ios
```

---

## 📱 **Alternative: Use QR Code Login Only**

If you don't want to create a development build, you can:

1. **Remove Google Login button** from the login screen
2. **Use only QR Code login** (which already works)
3. **Add Google login to the web app** instead

This way, users can:
- Scan QR code from web app
- Web app handles Google OAuth
- Mobile app gets authenticated via QR code

---

## 🚨 **Troubleshooting**

### **Issue: "plexcash:// is not a valid redirect URI"**

**Solution**: Make sure you added `plexcash://redirect` (with `://redirect`) to Google Cloud Console.

### **Issue: "App not installed" when redirecting**

**Solution**: You're using Expo Go. You need to build a development build with `npx expo run:android`.

### **Issue: Build fails**

**Solution**: 
```bash
# Clear cache and rebuild
npx expo prebuild --clean
npx expo run:android
```

---

## ✅ **Summary**

### **What You Need to Do:**

1. ✅ Add `plexcash://redirect` to Google Cloud Console (Web client)
2. ✅ Add your email as test user in OAuth consent screen
3. ✅ Build development build: `npx expo run:android`
4. ✅ Test Google login in the development build

### **What's Already Done:**

- ✅ Web Client ID configured in code
- ✅ Custom URL scheme configured in app.json
- ✅ Code updated to use custom scheme

---

## 🎉 **Expected Result**

After completing these steps:

1. ✅ Tap "Login with Google Account"
2. ✅ See alert: `plexcash://redirect`
3. ✅ Browser opens with Google account selection
4. ✅ Select account and grant permissions
5. ✅ Return to app successfully authenticated

Good luck! 🚀

