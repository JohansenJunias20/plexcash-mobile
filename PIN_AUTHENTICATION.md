# PIN Code Authentication System

## 🎯 **Overview**

The PlexCash mobile app now supports **PIN Code-based authentication** in addition to QR Code authentication. This provides an alternative, user-friendly authentication method where users can login using their email and a 10-digit PIN code generated from the web app.

## 🔄 **Authentication Flow**

### **Web Application (PIN Code Generation)**
1. User logs into web app with email/password
2. User navigates to Settings → Account tab
3. User clicks "Generate PIN Code"
4. Web app calls `/auth/generate-pin` endpoint
5. Backend generates a random 10-digit PIN code
6. PIN code is displayed with 5-minute expiration timer

### **Mobile Application (PIN Login)**
1. User opens mobile app
2. User selects "Login with PIN Code"
3. User enters their email address
4. User enters the 10-digit PIN code from web app
5. Mobile app calls `/auth/authorize-pin` endpoint
6. Backend validates PIN and returns JWT token
7. Mobile app stores token and user is logged in permanently

## 🔌 **API Endpoints**

### **POST /auth/generate-pin**
- **Purpose**: Generate PIN code for web app users
- **Authentication**: Required (existing web session)
- **Request**: Empty body
- **Response**:
```json
{
  "success": true,
  "pinCode": "1234567890",
  "sessionId": "uuid",
  "expiresAt": "2024-01-01T12:00:00.000Z",
  "message": "PIN code generated successfully"
}
```

### **POST /auth/authorize-pin**
- **Purpose**: Authenticate mobile app using PIN code
- **Authentication**: None required
- **Request**:
```json
{
  "email": "user@example.com",
  "pinCode": "1234567890",
  "deviceInfo": {
    "platform": "mobile",
    "deviceId": "unique-device-id",
    "deviceName": "iPhone 14",
    "osVersion": "17.0",
    "model": "iPhone14,2",
    "appVersion": "1.0.0"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Device authorized successfully with PIN",
  "user": {
    "email": "user@example.com"
  },
  "deviceId": "unique-device-id",
  "token": "jwt-token-here"
}
```

## 🔐 **Security Features**

- ✅ **5-minute expiration**: PIN codes expire after 5 minutes
- ✅ **Random generation**: Truly random 10-digit PIN codes
- ✅ **One-time use**: PIN is marked as 'used' after successful authentication
- ✅ **Session validation**: Each PIN has unique session ID
- ✅ **User validation**: Backend verifies user exists and is active
- ✅ **JWT tokens**: Mobile app receives secure JWT token (30-day expiration)
- ✅ **Device tracking**: Device info logged for security
- ✅ **Email validation**: PIN must match the email provided

## 📱 **Mobile App Components**

### **PINLogin Component** (`components/PINLogin.tsx`)
- Email input field
- 10-digit PIN input field (numeric keyboard)
- Login button with loading state
- Error handling and validation
- User-friendly instructions

### **LoginScreen Updates** (`components/LoginScreen.tsx`)
- Added "Login with PIN Code" button
- Green button with keypad icon
- Navigates to PINLogin component

### **AuthContext Updates** (`context/AuthContext.tsx`)
- Added `authorizePIN()` method
- Handles PIN authentication flow
- Stores device tokens securely
- Updates auth state on success

### **API Service Updates** (`services/api.ts`)
- Added `authorizePIN()` static method
- Calls `/auth/authorize-pin` endpoint
- Includes device information
- Returns standardized response

## 🗄️ **Database Schema**

### **Table: `user_mapping.pin_auth_sessions`**
```sql
CREATE TABLE pin_auth_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_email VARCHAR(255) NOT NULL,
  pin_code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  used_at DATETIME NULL,
  device_id VARCHAR(255) NULL,
  status ENUM('pending', 'used', 'expired', 'revoked') DEFAULT 'pending',
  ip_address VARCHAR(45) NULL,
  
  INDEX idx_user_email (user_email),
  INDEX idx_pin_code (pin_code),
  INDEX idx_expires_at (expires_at),
  INDEX idx_status (status)
);
```

## 🚀 **Deployment Steps**

### Step 1: Create PIN Sessions Table
```bash
docker exec -it plexseller_main_db mysql -uroot -pmantab99 user_mapping < CREATE_PIN_AUTH_SESSIONS_USER_MAPPING.sql
```

**Expected output:**
```
✅ pin_auth_sessions table created successfully in user_mapping database!
```

### Step 2: Restart Web Service
```bash
docker-compose -f docker-compose.prod.yml restart web
```

The TypeScript is already compiled via watch mode.

### Step 3: Test PIN Generation
```bash
# From web app (logged in user)
curl -X POST https://your-domain.com/auth/generate-pin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected:** PIN code generated, session stored in `user_mapping.pin_auth_sessions`

### Step 4: Test PIN Authorization
```bash
# From mobile app
curl -X POST https://your-domain.com/auth/authorize-pin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "pinCode": "1234567890",
    "deviceInfo": {"platform": "mobile"}
  }'
```

**Expected:** JWT token returned, device authorized!

## 📊 **Comparison: PIN vs QR Code**

| Feature | PIN Code | QR Code |
|---------|----------|---------|
| **Ease of Use** | Very Easy | Easy |
| **User Input** | Email + 10 digits | Camera scan |
| **Best For** | Quick login, no camera | Secure, no typing |
| **Expiration** | 5 minutes | 5 minutes |
| **Security** | High | High |
| **Accessibility** | Better (no camera needed) | Requires camera |

## ⚙️ **Mobile App Configuration**

### **API Base URL Setup**

Before testing, configure the correct API URL in `services/api.ts`:

**For Android Emulator:**
```typescript
export const API_BASE_URL = "http://10.0.2.2";
```
- `10.0.2.2` is a special alias to your host machine's `localhost`
- Works for Android Studio Emulator

**For Physical Device (same network):**
```typescript
export const API_BASE_URL = "http://192.168.1.210";
```
- Replace `192.168.1.210` with your computer's actual IP address
- Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

**For Production:**
```typescript
export const API_BASE_URL = "https://app.plexseller.com";
```

**Common Mistakes:**
- ❌ `https://localhost` - Won't work (SSL not configured for localhost)
- ❌ `http://localhost` - Won't work from physical device
- ✅ `http://10.0.2.2` - Works for Android Emulator
- ✅ `http://YOUR_COMPUTER_IP` - Works for physical device

## 🧪 **Testing Checklist**

### Web App Testing
- [ ] Login to web app
- [ ] Navigate to Settings → Account tab
- [ ] Click "Generate PIN Code"
- [ ] Verify 10-digit PIN is displayed
- [ ] Verify countdown timer shows 5:00
- [ ] Wait for expiration and verify error message
- [ ] Generate new PIN and verify old one is expired

### Mobile App Testing
- [ ] Open mobile app
- [ ] Tap "Login with PIN Code" button
- [ ] Enter valid email
- [ ] Enter valid 10-digit PIN
- [ ] Verify successful login
- [ ] Verify user stays logged in after app restart
- [ ] Test with expired PIN (should fail)
- [ ] Test with invalid PIN (should fail)
- [ ] Test with wrong email (should fail)
- [ ] Test with non-numeric PIN (should show validation error)

### Database Verification
```bash
# Check PIN sessions
docker exec -it plexseller_main_db mysql -uroot -pmantab99 -e "
  SELECT session_id, user_email, pin_code, status, created_at, expires_at
  FROM user_mapping.pin_auth_sessions
  ORDER BY created_at DESC
  LIMIT 10;
"
```

## 📁 **Files Modified/Created**

### Backend (PlexCash)
1. ✅ `CREATE_PIN_AUTH_SESSIONS_USER_MAPPING.sql` - Database table creation
2. ✅ `Server/index.ts` - Added `/auth/generate-pin` and `/auth/authorize-pin` endpoints
3. ✅ `Server/view/Components/core/Setting/Setting.tsx` - Added PIN generation UI

### Mobile App (PlexSeller-Mobile)
1. ✅ `components/PINLogin.tsx` - New PIN login screen
2. ✅ `components/LoginScreen.tsx` - Added PIN login button
3. ✅ `context/AuthContext.tsx` - Added PIN authentication support
4. ✅ `services/api.ts` - Added `authorizePIN()` method

### Documentation
1. ✅ `PIN_AUTHENTICATION.md` - This file

## ⚠️ **Important Notes**

1. **Centralized Database**: PIN sessions are stored in `user_mapping.pin_auth_sessions` (not in individual user databases) to prevent connection pool exhaustion
2. **Security**: PIN codes are truly random and expire after 5 minutes
3. **One-Time Use**: Each PIN can only be used once for authentication
4. **Device Tracking**: All authorized devices are tracked in `authorized_devices` table
5. **JWT Tokens**: Mobile devices receive 30-day JWT tokens for persistent authentication

## 🔍 **Monitoring**

Watch logs for successful PIN operations:
```bash
docker-compose -f docker-compose.prod.yml logs -f web | grep -E "AuthPIN|generate-pin"
```

**Good logs:**
```
[AuthPIN] Found PIN session: { user_email: 'user@example.com', status: 'pending' }
Secure PIN Code generated for user: user@example.com Session: abc-123
```

## 🎉 **Benefits**

1. **User-Friendly**: No need for camera or QR scanning
2. **Accessible**: Works on devices without camera
3. **Fast**: Quick to type 10 digits
4. **Secure**: Same security level as QR code authentication
5. **Flexible**: Users can choose between PIN or QR code
6. **Persistent**: One-time login, stays logged in for 30 days

## 🔗 **Related Documentation**

- [QR Code Authentication](QR_CODE_AUTHENTICATION.md)
- [QR Auth Fix Summary](QR_AUTH_FIX_SUMMARY.md)
- [Mobile OAuth Backend Flow](MOBILE_OAUTH_BACKEND_FLOW.md)

---

**Last Updated**: 2025-12-26
**Version**: 1.0.0
**Status**: ✅ Production Ready


