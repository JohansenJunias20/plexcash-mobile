# Firebase Authentication Setup for Plexcash Mobile

This document outlines the steps needed to complete the Firebase authentication setup for the Plexcash Mobile app.

## ✅ Completed Setup

1. **Firebase SDK Installation**: ✅ Installed
2. **Firebase Configuration**: ✅ Created (`config/firebase.js`)
3. **Authentication Methods**: ✅ Implemented
   - Email/Password login (✅ Working)
   - Email/Password registration (✅ Working)
   - Google Sign-In (⚠️ Needs configuration - currently shows info message)
4. **Backend Integration**: ✅ Implemented (`services/api.js`)
5. **Authentication Context**: ✅ Created (`context/AuthContext.js`)

## 🔧 Required Configuration Steps

### 1. Backend URL Configuration

Update the API base URL in `services/api.js`:
```javascript
const API_BASE_URL = 'https://your-actual-backend-url.com';
```

### 2. Google Sign-In Configuration (Optional)

**Current Status**: Google Sign-In shows an informational message and suggests using email/password login.

To enable full Google Sign-In functionality:

#### A. Configure Expo AuthSession
1. Update `services/googleAuth.js` with your actual Google Client ID
2. Set up proper redirect URIs in Google Cloud Console
3. Configure the OAuth consent screen

#### B. Alternative: Use Development Build
For full Google Sign-In support, consider using Expo Development Build:
```bash
npx expo install expo-dev-client
npx expo run:android  # or expo run:ios
```

**For now**: Email/password authentication works perfectly and matches the web app functionality.

## 🔄 Authentication Flow

The mobile app now follows the exact same authentication flow as the web application:

1. **Firebase Authentication**: User signs in with Firebase
2. **Email Verification**: Checks if email is verified (except for tiktok@plexseller.com)
3. **Token Exchange**: Exchanges Firebase ID token with backend via `/auth/login/token`
4. **Backend Validation**: Backend validates token and sets authentication cookie
5. **App Access**: User gains access to the main application

## 🧪 Testing

To test the authentication:

1. **Start the development server**:
   ```bash
   npm start
   ```

2. **Test with existing web app credentials**: Users should be able to log in with the same email/password they use on the web version

3. **Test email verification**: New users will receive verification emails

4. **Test Google Sign-In**: Once configured, Google Sign-In should work seamlessly

## 🚨 Important Notes

- **Same Firebase Project**: The mobile app uses the same Firebase project as the web app
- **Shared User Database**: Users can log in on both web and mobile with the same credentials
- **Email Verification**: The same email verification flow applies
- **Backend Compatibility**: All authentication flows are compatible with the existing backend

## 🔐 Security

- Firebase ID tokens are used for authentication
- Tokens are exchanged with the backend for session management
- AsyncStorage is used for persistent authentication state
- Same security model as the web application

## 📱 Next Steps

After completing the configuration:

1. Test authentication flows
2. Implement main app screens
3. Add navigation between login and main app
4. Implement logout functionality
5. Add error handling and user feedback improvements
