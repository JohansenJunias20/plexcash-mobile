# Google Sign-In Setup for Development Environment

## 🎯 **Quick Setup Guide**

Follow these steps to enable Google Sign-In in your development environment:

### **Step 1: Get Web Client ID from Firebase**

1. **Open Firebase Console**: https://console.firebase.google.com/
2. **Select Project**: `plex-seller-id`
3. **Go to Authentication**:
   - Click **Authentication** in left sidebar
   - Click **Sign-in method** tab
   - Find **Google** provider
4. **Enable Google Sign-In** (if not already enabled):
   - Click **Google**
   - Toggle **Enable**
   - Click **Save**
5. **Copy Web Client ID**:
   - You'll see a **Web client ID** like: `227685404880-abc123def456.apps.googleusercontent.com`
   - **Copy this ID**

### **Step 2: Configure the Mobile App**

1. **Open**: `services/googleAuth.js`
2. **Replace the Client ID**:
   ```javascript
   // Replace this line:
   const GOOGLE_CLIENT_ID = '227685404880-your-web-client-id.apps.googleusercontent.com';
   
   // With your actual Web Client ID:
   const GOOGLE_CLIENT_ID = '227685404880-abc123def456.apps.googleusercontent.com';
   ```

3. **Enable Google Sign-In**:
   ```javascript
   // Change this line:
   const ENABLE_GOOGLE_SIGNIN = false;
   
   // To:
   const ENABLE_GOOGLE_SIGNIN = true;
   ```

### **Step 3: Configure Google Cloud Console**

1. **Open Google Cloud Console**: https://console.cloud.google.com/
2. **Select Project**: `plex-seller-id`
3. **Go to APIs & Services** > **Credentials**
4. **Find your OAuth 2.0 client** (should match the Web Client ID)
5. **Add Authorized Redirect URIs**:
   - Click **Edit** on your OAuth client
   - In **Authorized redirect URIs**, add:
     ```
     https://auth.expo.io/@YOUR_EXPO_USERNAME/plexcash-mobile
     ```
   - Replace `YOUR_EXPO_USERNAME` with your actual Expo username
   - Click **Save**

### **Step 4: Test Google Sign-In**

1. **Restart your app**:
   ```bash
   npm start
   ```

2. **Test the Google Sign-In button**:
   - Should open Google's OAuth page
   - Allow you to select/login with Google account
   - Return to app with successful authentication

## 🔧 **Troubleshooting**

### **Common Issues:**

#### **"Configuration Required" Message**
- **Cause**: `ENABLE_GOOGLE_SIGNIN` is still `false` or Client ID not configured
- **Solution**: Follow Step 2 above

#### **"Invalid Client ID" Error**
- **Cause**: Wrong Client ID or not configured in Google Cloud Console
- **Solution**: Double-check Client ID from Firebase Console

#### **"Redirect URI Mismatch" Error**
- **Cause**: Redirect URI not configured in Google Cloud Console
- **Solution**: Add the correct redirect URI in Step 3

#### **"Network Error" or "Failed to Fetch"**
- **Cause**: Internet connection or Google services issue
- **Solution**: Check internet connection, try again

### **Debug Information:**

The app will log helpful information in the console:
```
Starting Google Sign-In with Expo AuthSession...
Redirect URI: https://auth.expo.io/@username/plexcash-mobile
Auth result: { type: 'success', params: {...} }
Token response received
```

## 🚀 **Alternative: Development Build (Advanced)**

For more advanced Google Sign-In features, you can use Expo Development Build:

```bash
# Install development build
npx expo install expo-dev-client

# Build for Android
npx expo run:android

# Build for iOS  
npx expo run:ios
```

This allows you to use native Google Sign-In packages with more features.

## ✅ **Verification**

After setup, you should be able to:

1. **Tap Google Sign-In button** → Opens Google OAuth page
2. **Select Google account** → Authenticates with Google
3. **Return to app** → Shows success message
4. **Same user in Firebase** → User appears in Firebase Authentication console

## 📱 **Development vs Production**

### **Development (Expo Go)**
- ✅ Uses `expo-auth-session`
- ✅ Works with Expo Go
- ✅ No native code compilation needed
- ⚠️ Requires proper redirect URI configuration

### **Production (Standalone App)**
- ✅ Can use native Google Sign-In packages
- ✅ Better performance and UX
- ✅ More customization options
- ⚠️ Requires app building and deployment

## 🔐 **Security Notes**

- **Web Client ID**: Safe to include in mobile app code
- **Client Secret**: Never include in mobile app (not needed for mobile)
- **Redirect URIs**: Must be properly configured to prevent attacks
- **Scopes**: Only request necessary permissions (openid, profile, email)

Your Google Sign-In should now work perfectly in the development environment! 🎉
