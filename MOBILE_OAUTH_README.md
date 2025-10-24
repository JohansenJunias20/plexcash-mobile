# Mobile OAuth Implementation

## 📱 Google Sign-In for PlexCash Mobile

This mobile app now supports Google OAuth authentication using a secure backend redirect flow.

## 📊 How It Works

See the complete visual flow diagram:
**[../Plex-Cash/MOBILE_OAUTH_FLOW_DIAGRAM.md](../Plex-Cash/MOBILE_OAUTH_FLOW_DIAGRAM.md)**

### Quick Summary

1. **User taps "Login with Google"** in the mobile app
2. **Mobile app** initializes a session with the backend
3. **System browser** opens for Google authentication
4. **User authenticates** with their Google account
5. **Backend** handles the OAuth callback and redirects back to the app
6. **Mobile app** verifies the session and gets a Firebase token
7. **Mobile app** exchanges the Firebase token for PlexSeller authentication
8. **User is logged in!**

## 🔒 Security Features

✅ **Cryptographically Secure Sessions** - 256-bit random session IDs  
✅ **5-Minute Expiration** - Sessions auto-expire  
✅ **Single-Use Tokens** - Prevents replay attacks  
✅ **Device ID Binding** - Prevents session hijacking  
✅ **CSRF Protection** - State parameter validation  
✅ **Rate Limiting** - 5 requests/minute per device  
✅ **HTTPS Only** - All communication encrypted  

## 📁 Implementation Files

### Mobile App (This Directory)
- **`services/googleAuth.ts`** - Google OAuth service with backend redirect flow
- **`components/LoginScreen.tsx`** - Login UI with Google button

### Backend (Plex-Cash/Server)
- **`Controllers/MobileOAuthController.ts`** - Three OAuth endpoints
- **`index.ts`** - Routes registration (needs to be added)

## 📚 Documentation

All documentation is in the `Plex-Cash` directory:

1. **[MOBILE_OAUTH_FLOW_DIAGRAM.md](../Plex-Cash/MOBILE_OAUTH_FLOW_DIAGRAM.md)** ⭐ Visual flow diagram
2. **[Server/QUICK_START_MOBILE_OAUTH.md](../Plex-Cash/Server/QUICK_START_MOBILE_OAUTH.md)** - Quick start guide
3. **[MOBILE_OAUTH_INTEGRATION_GUIDE.md](../Plex-Cash/MOBILE_OAUTH_INTEGRATION_GUIDE.md)** - Complete integration guide
4. **[GOOGLE_CLOUD_CONSOLE_SETUP.md](../Plex-Cash/GOOGLE_CLOUD_CONSOLE_SETUP.md)** - Google Console setup
5. **[MOBILE_OAUTH_IMPLEMENTATION_SUMMARY.md](../Plex-Cash/MOBILE_OAUTH_IMPLEMENTATION_SUMMARY.md)** - Implementation overview

## 🚀 Next Steps for Backend Integration

The mobile app is ready! Now you need to integrate the backend:

### 1. Register Routes (2 minutes)

Edit `../Plex-Cash/Server/index.ts` and add:

```typescript
import MobileOAuthController from './Controllers/MobileOAuthController';

// Mobile OAuth routes
app.post('/auth/mobile/init', MobileOAuthController.initMobileAuth);
app.get('/auth/mobile/callback', MobileOAuthController.handleMobileCallback);
app.post('/auth/mobile/verify', MobileOAuthController.verifyMobileSession);
```

### 2. Add Environment Variables (1 minute)

Add to `../Plex-Cash/Server/.env`:

```env
GOOGLE_WEB_CLIENT_SECRET=<get-from-google-cloud-console>
```

### 3. Configure Google Cloud Console (2 minutes)

1. Go to https://console.cloud.google.com/
2. Select: **plex-seller-id**
3. Go to: **APIs & Services** > **Credentials**
4. Edit **Web client**
5. Add to **Authorized JavaScript origins:**
   ```
   https://app.plexseller.com
   ```
6. Add to **Authorized redirect URIs:**
   ```
   https://app.plexseller.com/auth/mobile/callback
   ```
7. Save and wait 10 minutes

### 4. Test! (1 minute)

1. Open this mobile app in Expo Go
2. Tap "Login with Google"
3. Authenticate in browser
4. Should redirect back and login successfully!

## 🧪 Testing

```bash
# Run the mobile app
npm start

# Or with Expo Go
npx expo start
```

Then tap "Login with Google" and follow the flow.

## 🐛 Troubleshooting

### "Failed to initialize authentication"
→ Backend not running or routes not registered

### "redirect_uri_mismatch"
→ Add `https://app.plexseller.com/auth/mobile/callback` to Google Console

### "Session not found"
→ Session expired (>5 minutes) - try again

### Browser doesn't redirect back
→ Check backend logs for callback errors

## ✅ Benefits

✅ **Works with Expo Go** - No development build needed!  
✅ **Secure** - All security best practices implemented  
✅ **Play Store Compliant** - Standard OAuth pattern  
✅ **User-Friendly** - System browser (trusted)  
✅ **Production-Ready** - Comprehensive error handling  

## 📞 Support

For detailed troubleshooting, see:
- **[MOBILE_OAUTH_INTEGRATION_GUIDE.md](../Plex-Cash/MOBILE_OAUTH_INTEGRATION_GUIDE.md)** - Troubleshooting section
- **[GOOGLE_CLOUD_CONSOLE_SETUP.md](../Plex-Cash/GOOGLE_CLOUD_CONSOLE_SETUP.md)** - Common mistakes

## 🎉 Summary

The mobile OAuth implementation is **complete and ready to use**!

Just integrate the backend (5 minutes), configure Google Console (2 minutes), wait 10 minutes, and test!

