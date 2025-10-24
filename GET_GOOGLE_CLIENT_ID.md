# How to Get Google Client ID for Plexcash Mobile

## 🎯 **Quick Steps to Enable Google Sign-In**

Since I found your Firebase project configuration, here's exactly what you need to do:

### **Your Firebase Project Details:**
- **Project ID**: `plex-seller-id`
- **Messaging Sender ID**: `227685404880`
- **App ID**: `1:227685404880:web:7b5e542ef193a3c0c34ed5`

### **Step 1: Get Web Client ID from Firebase Console**

1. **Open Firebase Console**: https://console.firebase.google.com/
2. **Select Project**: `plex-seller-id` (your existing project)
3. **Go to Authentication**:
   - Click **Authentication** in the left sidebar
   - Click **Sign-in method** tab
4. **Find Google Provider**:
   - Look for **Google** in the sign-in providers list
   - If it's not enabled, click **Google** and enable it
5. **Copy the Web Client ID**:
   - You'll see a **Web client ID** that looks like:
   ```
   227685404880-abc123def456ghi789jkl.apps.googleusercontent.com
   ```
   - **Copy this entire ID**

### **Step 2: Update Mobile App Configuration**

1. **Open**: `services/googleAuth.js`
2. **Replace line 9**:
   ```javascript
   // Change this:
   const GOOGLE_CLIENT_ID = '227685404880-your-web-client-id.apps.googleusercontent.com';
   
   // To your actual Web Client ID (example):
   const GOOGLE_CLIENT_ID = '227685404880-abc123def456ghi789jkl.apps.googleusercontent.com';
   ```

3. **Enable Google Sign-In on line 12**:
   ```javascript
   // Change this:
   const ENABLE_GOOGLE_SIGNIN = false;
   
   // To:
   const ENABLE_GOOGLE_SIGNIN = true;
   ```

### **Step 3: Configure Redirect URI (Important!)**

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select Project**: `plex-seller-id`
3. **Go to APIs & Services** > **Credentials**
4. **Find your OAuth 2.0 client** (should match the Web Client ID)
5. **Click Edit** on the OAuth client
6. **Add Authorized Redirect URI**:
   ```
   https://auth.expo.io/@YOUR_EXPO_USERNAME/plexcash-mobile
   ```
   - Replace `YOUR_EXPO_USERNAME` with your actual Expo username
   - You can find your Expo username by running: `npx expo whoami`

### **Step 4: Test Google Sign-In**

1. **Restart your app**:
   ```bash
   npm start
   ```

2. **Test the Google Sign-In button**:
   - Should open Google's OAuth page in browser
   - Allow you to select/login with Google account
   - Return to app with successful authentication

## 🔧 **If You Don't Have Google Sign-In Enabled Yet**

If Google Sign-In is not enabled in Firebase Console:

1. **Enable Google Sign-In**:
   - In Firebase Console > Authentication > Sign-in method
   - Click **Google**
   - Toggle **Enable**
   - It will automatically create a Web Client ID
   - Click **Save**

2. **The Web Client ID will be generated automatically** and displayed

## 🚀 **Expected Result**

After configuration, when you tap the Google Sign-In button:

1. **Opens browser** with Google OAuth page
2. **User selects Google account** and grants permissions
3. **Returns to app** with successful authentication
4. **Same user appears** in Firebase Authentication console
5. **User can access** the same account on both web and mobile

## 📱 **Current Status**

- ✅ **Firebase Configuration**: Already matches your web app
- ✅ **Email/Password Auth**: Fully working
- ⚠️ **Google Sign-In**: Needs Web Client ID configuration
- ✅ **Backend Integration**: Ready (simulated for development)

## 🔐 **Security Note**

The Web Client ID is safe to include in your mobile app code. It's designed to be public and is used for OAuth flow initiation. The actual authentication security is handled by Firebase and Google's OAuth servers.

## 🎉 **After Setup**

Once configured, your users will be able to:
- **Login with Google** on both web and mobile
- **Use same account** across platforms
- **Seamless authentication** experience
- **Same Firebase user database**

Your Google Sign-In will work perfectly with the existing Plexcash web application! 🚀
