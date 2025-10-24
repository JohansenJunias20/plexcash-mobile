# QR Code Authentication System

## 🎯 **Overview**

The PlexCash mobile app now uses a **QR Code-based authentication system** instead of complex Google OAuth. This provides a simpler, more secure, and user-friendly authentication experience.

## 🔄 **Authentication Flow**

### **Web Application (QR Code Generation)**
1. User logs into web app with email/password
2. User clicks "Generate QR Code for Mobile Login"
3. Web app calls `/auth/generate-qr` endpoint
4. Backend generates QR code with format: `plexcash-auth:{sessionId}:{timestamp}:{userEmail}`
5. QR code is displayed with 5-minute expiration timer

### **Mobile Application (QR Code Scanning)**
1. User opens mobile app
2. User taps "📱 Scan QR Code to Login" button
3. Camera opens with QR code scanner
4. User scans QR code from web application
5. Mobile app calls `/auth/qr-login` endpoint with scanned data
6. Backend validates QR code and returns JWT token
7. Mobile app stores authentication data and logs user in

## 🛠️ **Technical Implementation**

### **Backend API Endpoints**

#### **POST /auth/generate-qr**
- **Purpose**: Generate QR code for web app users
- **Authentication**: Required (existing web session)
- **Request**: Empty body
- **Response**:
```json
{
  "success": true,
  "qrData": "plexcash-auth:uuid:timestamp:email",
  "sessionId": "uuid",
  "expiresAt": "2024-01-01T12:00:00.000Z",
  "message": "QR code generated successfully"
}
```

#### **POST /auth/qr-login**
- **Purpose**: Authenticate mobile app using QR code
- **Authentication**: None required
- **Request**:
```json
{
  "qrData": "plexcash-auth:uuid:timestamp:email",
  "deviceInfo": {
    "platform": "mobile",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "email": "user@example.com",
    "nama": "User Name"
  },
  "token": "jwt-token-here"
}
```

### **QR Code Format**
```
plexcash-auth:{sessionId}:{timestamp}:{userEmail}
```

**Components:**
- `plexcash-auth`: Fixed prefix for validation
- `sessionId`: UUID for session tracking
- `timestamp`: Unix timestamp for expiration
- `userEmail`: Email of authenticated web user

### **Security Features**
- ✅ **5-minute expiration**: QR codes expire after 5 minutes
- ✅ **Session validation**: Each QR code has unique session ID
- ✅ **User validation**: Backend verifies user exists and is active
- ✅ **JWT tokens**: Mobile app receives secure JWT token
- ✅ **Device tracking**: Device info logged for security

## 📱 **Mobile App Components**

### **QRCodeScanner.js**
- Camera-based QR code scanner
- Permission handling
- Error handling and retry logic
- Professional UI with scan area overlay

### **Updated LoginScreen.js**
- Added QR code login button
- Integrated with QRCodeScanner component
- Maintained email/password login option
- Removed complex Google OAuth

### **Updated AuthContext.js**
- Added `authenticateWithQRCode()` method
- Support for both Firebase and QR code authentication
- Proper token storage and management

## 🌐 **Web App Components**

### **QRLogin.tsx**
- QR code generation and display
- 5-minute countdown timer
- Auto-refresh when expired
- User instructions and guidance

## 🔧 **Installation & Setup**

### **Mobile App Dependencies**
```bash
npm install expo-camera expo-barcode-scanner
```

### **Required Permissions**
- **Camera**: For QR code scanning
- **Storage**: For authentication token storage

### **Backend Requirements**
- JWT secret for token generation
- Database access for user validation
- Session management (optional: Redis for production)

## 🎨 **User Experience**

### **Before (Google OAuth)**
1. Tap Google Sign-In → Opens browser
2. Select Google account → External authentication
3. Grant permissions → Multiple redirects
4. Return to app → Complex flow

### **After (QR Code)**
1. Tap "Scan QR Code" → Opens camera
2. Scan QR code → Instant authentication
3. Login successful → Direct access

## 🔒 **Security Considerations**

### **Advantages**
- ✅ **No external dependencies**: No Google OAuth complexity
- ✅ **Time-limited**: QR codes expire quickly
- ✅ **Session-based**: Each QR code is unique
- ✅ **Local validation**: Backend controls authentication
- ✅ **Audit trail**: All authentications logged

### **Best Practices**
- QR codes should only be displayed on secure connections (HTTPS)
- Mobile app should validate QR code format before sending
- Backend should rate-limit QR code generation
- Consider implementing device registration for enhanced security

## 🚀 **Future Enhancements**

### **Planned Features**
- [ ] **Push notifications**: Notify web app when mobile login successful
- [ ] **Device management**: List and manage authenticated devices
- [ ] **Biometric authentication**: Add fingerprint/face ID support
- [ ] **Offline QR codes**: Generate QR codes that work without internet

### **Production Considerations**
- [ ] **Redis integration**: Store sessions in Redis for scalability
- [ ] **Rate limiting**: Prevent QR code generation abuse
- [ ] **Monitoring**: Track authentication success/failure rates
- [ ] **Analytics**: Monitor user adoption of QR vs traditional login

## 📊 **Benefits**

### **For Users**
- ✅ **Faster login**: No browser redirects
- ✅ **More secure**: No external OAuth dependencies
- ✅ **Better UX**: Native camera integration
- ✅ **Reliable**: Works without internet connectivity issues

### **For Developers**
- ✅ **Simpler code**: No complex OAuth flows
- ✅ **Better control**: Full authentication control
- ✅ **Easier debugging**: Clear error messages
- ✅ **Reduced dependencies**: Fewer external services

### **For Business**
- ✅ **Cost effective**: No Google OAuth quotas/costs
- ✅ **Brand consistency**: No external login screens
- ✅ **Data privacy**: User data stays in your system
- ✅ **Compliance**: Easier GDPR/privacy compliance

## 🔍 **Troubleshooting**

### **Common Issues**

#### **"Camera permission denied"**
- **Solution**: Enable camera permissions in device settings

#### **"QR code has expired"**
- **Solution**: Generate new QR code from web app

#### **"Invalid QR code format"**
- **Solution**: Ensure scanning official PlexCash QR codes only

#### **"User not found"**
- **Solution**: Ensure user exists and is active in system

#### **"Network error"**
- **Solution**: Check internet connection and API endpoint

## 📝 **Migration Notes**

### **Removed Components**
- ❌ `GoogleAuthService` - No longer needed
- ❌ `ShowRedirectURI` - QR codes don't need redirect URIs
- ❌ Google OAuth configuration - Simplified authentication

### **Updated Components**
- ✅ `LoginScreen` - Added QR code option
- ✅ `AuthContext` - Support for QR authentication
- ✅ `App.js` - Cleaned up Google dependencies

This QR code authentication system provides a modern, secure, and user-friendly alternative to traditional OAuth flows! 🎉
