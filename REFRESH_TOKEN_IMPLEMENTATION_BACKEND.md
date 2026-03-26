# Refresh Token Implementation - Backend Guide

## 📋 Overview

This document provides the backend implementation guide for adding refresh token mechanism to mobile device authentication. This enables permanent login for mobile users even after access tokens expire.

## 🎯 Goals

- Add refresh token generation for mobile device authorization
- Implement token refresh endpoint
- Maintain backward compatibility with web authentication (Firebase + cookies)
- Support 90-day refresh token expiry (configurable)

---

## 🗄️ Database Changes

### 1. Add Refresh Token Column to `authorized_devices` Table

```sql
-- Add refresh_token and refresh_token_expires_at columns
ALTER TABLE user_mapping.authorized_devices
ADD COLUMN refresh_token VARCHAR(500) NULL AFTER device_token,
ADD COLUMN refresh_token_expires_at DATETIME NULL AFTER refresh_token,
ADD INDEX idx_refresh_token (refresh_token);
```

---

## 🔧 Backend Implementation (Server/index.ts)

### 1. JWT Token Generation Helper

Add this helper function to generate both access and refresh tokens:

```typescript
import jwt from 'jsonwebtoken';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/**
 * Generate access token and refresh token pair for mobile device authentication
 */
function generateTokenPair(email: string, deviceId: string): TokenPair {
  const SECRET = process.env.SECRET || 'your-secret-key';
  
  // Access token - expires in 1 hour
  const accessTokenExpiresIn = 3600; // 1 hour in seconds
  const accessToken = jwt.sign(
    { 
      email, 
      deviceId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    },
    SECRET,
    { expiresIn: accessTokenExpiresIn }
  );
  
  // Refresh token - expires in 90 days
  const refreshTokenExpiresIn = 90 * 24 * 60 * 60; // 90 days in seconds
  const refreshToken = jwt.sign(
    { 
      email, 
      deviceId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    },
    SECRET,
    { expiresIn: refreshTokenExpiresIn }
  );
  
  return {
    accessToken,
    refreshToken,
    expiresIn: accessTokenExpiresIn,
    refreshExpiresIn: refreshTokenExpiresIn
  };
}
```

### 2. Update `/auth/authorize-device` Endpoint

Modify the QR code authorization endpoint to generate and return refresh token:

```typescript
app.post('/auth/authorize-device', async (req, res) => {
  try {
    const { qrData, deviceInfo } = req.body;
    
    // ... existing QR validation logic ...
    
    // After successful QR validation, generate token pair
    const { accessToken, refreshToken, expiresIn, refreshExpiresIn } = generateTokenPair(
      userEmail,
      deviceId
    );
    
    // Calculate refresh token expiry date
    const refreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);
    
    // Store device authorization with refresh token
    await tempConnection.query(
      `INSERT INTO user_mapping.authorized_devices 
       (device_id, user_email, device_info, device_token, refresh_token, refresh_token_expires_at, authorized_at, last_used_at, status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 'active')
       ON DUPLICATE KEY UPDATE 
         device_token = VALUES(device_token),
         refresh_token = VALUES(refresh_token),
         refresh_token_expires_at = VALUES(refresh_token_expires_at),
         last_used_at = NOW(),
         status = 'active'`,
      [deviceId, userEmail, JSON.stringify(deviceInfo), accessToken, refreshToken, refreshTokenExpiresAt]
    );
    
    // Return both tokens to mobile app
    res.json({
      success: true,
      message: 'Device authorized successfully',
      user: { email: userEmail },
      token: accessToken,              // Access token
      refreshToken: refreshToken,      // Refresh token (NEW)
      expiresIn: expiresIn,            // Access token expiry (NEW)
      refreshExpiresIn: refreshExpiresIn, // Refresh token expiry (NEW)
      deviceId: deviceId
    });
    
  } catch (error) {
    console.error('Device authorization error:', error);
    res.status(500).json({ success: false, message: 'Authorization failed' });
  }
});
```

### 3. Update `/auth/authorize-pin` Endpoint

Similar changes for PIN authorization:

```typescript
app.post('/auth/authorize-pin', async (req, res) => {
  try {
    const { email, pinCode, deviceInfo } = req.body;
    
    // ... existing PIN validation logic ...
    
    // After successful PIN validation, generate token pair
    const { accessToken, refreshToken, expiresIn, refreshExpiresIn } = generateTokenPair(
      email,
      deviceId
    );
    
    // Calculate refresh token expiry date
    const refreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);
    
    // Store device authorization with refresh token
    await tempConnection.query(
      `INSERT INTO user_mapping.authorized_devices 
       (device_id, user_email, device_info, device_token, refresh_token, refresh_token_expires_at, authorized_at, last_used_at, status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 'active')
       ON DUPLICATE KEY UPDATE 
         device_token = VALUES(device_token),
         refresh_token = VALUES(refresh_token),
         refresh_token_expires_at = VALUES(refresh_token_expires_at),
         last_used_at = NOW(),
         status = 'active'`,
      [deviceId, email, JSON.stringify(deviceInfo), accessToken, refreshToken, refreshTokenExpiresAt]
    );
    
    // Return both tokens to mobile app
    res.json({
      success: true,
      message: 'Device authorized successfully with PIN',
      user: { email: email },
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: expiresIn,
      refreshExpiresIn: refreshExpiresIn,
      deviceId: deviceId
    });
    
  } catch (error) {
    console.error('PIN authorization error:', error);
    res.status(500).json({ success: false, message: 'Authorization failed' });
  }
});
```

### 4. Update `/auth/validate-device` Endpoint

This is the KEY endpoint for refresh token mechanism. It validates the refresh token and issues a new access token:

```typescript
app.post('/auth/validate-device', async (req, res) => {
  try {
    const { authToken, refreshToken, deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device ID required' });
    }

    // Get device from database
    const [devices]: any = await tempConnection.query(
      `SELECT device_id, user_email, device_token, refresh_token, refresh_token_expires_at, status
       FROM user_mapping.authorized_devices
       WHERE device_id = ?
       LIMIT 1`,
      [deviceId]
    );

    if (!devices || devices.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    const device = devices[0];

    // Check if device is revoked
    if (device.status === 'revoked') {
      return res.status(403).json({ success: false, message: 'Device has been revoked' });
    }

    const userEmail = device.user_email;

    // STRATEGY 1: Try to verify existing access token first
    if (authToken) {
      try {
        const SECRET = process.env.SECRET || 'your-secret-key';
        const decoded = jwt.verify(authToken, SECRET) as any;

        // Access token is still valid
        if (decoded.email === userEmail && decoded.deviceId === deviceId) {
          // Update last_used_at
          await tempConnection.query(
            `UPDATE user_mapping.authorized_devices
             SET last_used_at = NOW()
             WHERE device_id = ?`,
            [deviceId]
          );

          return res.json({
            success: true,
            message: 'Device validation successful',
            user: { email: userEmail },
            authToken: authToken // Return same token (still valid)
          });
        }
      } catch (tokenError) {
        // Access token expired or invalid - continue to refresh token validation
        console.log('Access token expired, attempting refresh...');
      }
    }

    // STRATEGY 2: Access token expired, use refresh token
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Access token expired and no refresh token provided'
      });
    }

    // Verify refresh token from database matches
    if (device.refresh_token !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Check if refresh token has expired
    const refreshExpiresAt = new Date(device.refresh_token_expires_at);
    if (refreshExpiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please login again.'
      });
    }

    // Verify refresh token signature
    try {
      const SECRET = process.env.SECRET || 'your-secret-key';
      const decoded = jwt.verify(refreshToken, SECRET) as any;

      if (decoded.email !== userEmail || decoded.deviceId !== deviceId || decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate NEW access token (refresh token remains the same)
      const accessTokenExpiresIn = 3600; // 1 hour
      const newAccessToken = jwt.sign(
        {
          email: userEmail,
          deviceId: deviceId,
          type: 'access',
          iat: Math.floor(Date.now() / 1000)
        },
        SECRET,
        { expiresIn: accessTokenExpiresIn }
      );

      // Update device_token and last_used_at in database
      await tempConnection.query(
        `UPDATE user_mapping.authorized_devices
         SET device_token = ?, last_used_at = NOW()
         WHERE device_id = ?`,
        [newAccessToken, deviceId]
      );

      // Return new access token
      return res.json({
        success: true,
        message: 'Token refreshed successfully',
        user: { email: userEmail },
        authToken: newAccessToken,  // NEW access token
        expiresIn: accessTokenExpiresIn
      });

    } catch (refreshTokenError) {
      console.error('Refresh token verification failed:', refreshTokenError);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token signature'
      });
    }

  } catch (error) {
    console.error('Device validation error:', error);
    res.status(500).json({ success: false, message: 'Validation failed' });
  }
});
```

---

## 🔒 Security Considerations

### 1. Refresh Token Rotation (Optional - Enhanced Security)

For maximum security, you can implement refresh token rotation where each refresh generates a NEW refresh token:

```typescript
// After successful refresh, generate new refresh token pair
const { accessToken, refreshToken: newRefreshToken, expiresIn, refreshExpiresIn } = generateTokenPair(
  userEmail,
  deviceId
);

const refreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000);

// Update BOTH access token and refresh token
await tempConnection.query(
  `UPDATE user_mapping.authorized_devices
   SET device_token = ?,
       refresh_token = ?,
       refresh_token_expires_at = ?,
       last_used_at = NOW()
   WHERE device_id = ?`,
  [accessToken, newRefreshToken, refreshTokenExpiresAt, deviceId]
);

// Return both new tokens
return res.json({
  success: true,
  message: 'Token refreshed successfully',
  user: { email: userEmail },
  authToken: accessToken,
  refreshToken: newRefreshToken,  // NEW refresh token
  expiresIn: expiresIn,
  refreshExpiresIn: refreshExpiresIn
});
```

### 2. Refresh Token Revocation

To revoke a device's access:

```typescript
// Revoke device
await tempConnection.query(
  `UPDATE user_mapping.authorized_devices
   SET status = 'revoked', refresh_token = NULL, refresh_token_expires_at = NULL
   WHERE device_id = ?`,
  [deviceId]
);
```

---

## 📝 Testing

### Test Token Generation

```bash
curl -X POST https://your-domain.com/auth/authorize-pin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "pinCode": "1234567890",
    "deviceInfo": {"platform": "mobile"}
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Device authorized successfully with PIN",
  "user": { "email": "user@example.com" },
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 3600,
  "refreshExpiresIn": 7776000,
  "deviceId": "device-123"
}
```

### Test Token Refresh

```bash
curl -X POST https://your-domain.com/auth/validate-device \
  -H "Content-Type: application/json" \
  -d '{
    "authToken": "expired_access_token",
    "refreshToken": "valid_refresh_token",
    "deviceId": "device-123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "user": { "email": "user@example.com" },
  "authToken": "new_access_token",
  "expiresIn": 3600
}
```

---

## ⚠️ Important Notes

1. **Web Authentication NOT Affected**: Web app continues to use Firebase ID tokens and cookie-based sessions
2. **Mobile-Only Feature**: Refresh tokens are ONLY for mobile device authorization (QR/PIN)
3. **Backward Compatibility**: Existing mobile devices without refresh tokens will continue to work (they'll need to re-login after token expires)
4. **Token Expiry**: Access token = 1 hour, Refresh token = 90 days (configurable)
5. **Database Migration**: Run the ALTER TABLE command before deploying backend changes

---

## 📋 Deployment Checklist

- [ ] Run database migration (ALTER TABLE)
- [ ] Update `Server/index.ts` with new token generation logic
- [ ] Update `/auth/authorize-device` endpoint
- [ ] Update `/auth/authorize-pin` endpoint
- [ ] Update `/auth/validate-device` endpoint
- [ ] Test token generation
- [ ] Test token refresh
- [ ] Verify web authentication still works
- [ ] Deploy to production
- [ ] Update mobile app to use new token fields

