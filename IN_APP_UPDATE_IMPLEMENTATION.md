# In-App Update Implementation

## Overview
Implementasi fitur in-app updates untuk aplikasi PlexSeller mobile yang meminta user untuk update aplikasi ketika ada versi baru.

## Features Implemented

### 1. **Automatic Update Check**
- Aplikasi otomatis memeriksa update saat startup
- Check dilakukan setiap 6 jam untuk tidak mengganggu user
- Support untuk force update (wajib) dan optional update

### 2. **Update Modal**
- Modal yang menarik dengan informasi versi
- Menampilkan release notes
- Tombol untuk update, skip, atau nanti
- Loading indicator saat mengunduh update

### 3. **Manual Check**
- User bisa manual check update dari Settings screen
- Menampilkan versi saat ini dan build number

### 4. **Two Types of Updates**

#### A. Store Updates (Full App Update)
- Update melalui Google Play Store atau App Store
- Memerlukan backend API untuk version checking
- Bisa di-force (wajib update) atau optional

#### B. OTA Updates (Over-The-Air)
- Update menggunakan Expo Updates
- Untuk perubahan JavaScript/assets tanpa rebuild native
- Otomatis reload setelah download

## Files Created/Modified

### New Files
1. **`services/versionCheck.ts`** - Service untuk version checking
2. **`components/UpdateModal.tsx`** - Modal UI untuk update prompt
3. **`hooks/useAppUpdate.ts`** - Custom hook untuk update logic

### Modified Files
1. **`App.tsx`** - Added UpdateModal integration
2. **`app.json`** - Added expo-updates configuration
3. **`screens/Settingscreen.tsx`** - Added version info and check update button
4. **`package.json`** - Added expo-application and expo-updates

## Backend Implementation Required

Anda perlu menambahkan endpoint di backend server untuk version checking:

### Endpoint: `/api/app/version-check`

**Request:**
```json
POST /api/app/version-check
{
  "platform": "android" | "ios",
  "currentVersion": "1.0.1"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "latestVersion": "1.1.0",
    "updateAvailable": true,
    "forceUpdate": false,
    "updateUrl": "https://play.google.com/store/apps/details?id=com.plexcash.mobile",
    "releaseNotes": "- Bug fixes\n- Performance improvements\n- New features added"
  }
}
```

### Backend Implementation Example (Node.js/Express)

```javascript
// Server/routes/app.js

const express = require('express');
const router = express.Router();

// App version configuration
const APP_VERSIONS = {
  android: {
    latest: '1.1.0',
    minimum: '1.0.0', // Versions below this require force update
    releaseNotes: '- Bug fixes\n- Performance improvements\n- New features',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.plexcash.mobile'
  },
  ios: {
    latest: '1.1.0',
    minimum: '1.0.0',
    releaseNotes: '- Bug fixes\n- Performance improvements\n- New features',
    storeUrl: 'https://apps.apple.com/app/plexseller/id123456789'
  }
};

// Compare version strings
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  
  return 0;
}

router.post('/version-check', async (req, res) => {
  try {
    const { platform, currentVersion } = req.body;
    
    if (!platform || !currentVersion) {
      return res.status(400).json({
        status: false,
        message: 'Missing platform or currentVersion'
      });
    }
    
    const config = APP_VERSIONS[platform.toLowerCase()];
    
    if (!config) {
      return res.status(400).json({
        status: false,
        message: 'Invalid platform'
      });
    }
    
    // Check if update is available
    const updateAvailable = compareVersions(config.latest, currentVersion) > 0;
    
    // Check if force update is required
    const forceUpdate = compareVersions(currentVersion, config.minimum) < 0;
    
    res.json({
      status: true,
      data: {
        latestVersion: config.latest,
        updateAvailable,
        forceUpdate,
        updateUrl: config.storeUrl,
        releaseNotes: config.releaseNotes
      }
    });
    
  } catch (error) {
    console.error('Version check error:', error);
    res.status(500).json({
      status: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
```

### Integrate into main server file:

```javascript
// Server/server.js or index.js
const appRoutes = require('./routes/app');
app.use('/api/app', appRoutes);
```

## Configuration

### 1. Update API URL
Edit `services/versionCheck.ts` dan ganti URL API:

```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-api-url.com';
```

Atau tambahkan di `.env`:
```
EXPO_PUBLIC_API_URL=https://your-backend-url.com
```

### 2. Update app.json
Versi sudah dikonfigurasi di `app.json`:
- `version`: "1.0.1" (semantic version)
- `android.versionCode`: 7 (increment untuk setiap build)

### 3. EAS Updates (Optional)
Untuk menggunakan OTA updates:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure updates
eas update:configure

# Publish an update
eas update --branch production --message "Bug fixes"
```

## Usage

### For Users
1. **Automatic Check**: Aplikasi otomatis check update saat dibuka
2. **Manual Check**: Buka Settings → General → "Check for Updates"
3. **Update Options**:
   - **Update Sekarang**: Update segera (atau buka store jika perlu)
   - **Nanti**: Tutup modal, akan muncul lagi next session
   - **Lewati Versi Ini**: Tidak akan diminta lagi untuk versi ini

### For Developers

#### Trigger Force Update
Set `forceUpdate: true` di backend untuk versi tertentu:
```javascript
const forceUpdate = compareVersions(currentVersion, config.minimum) < 0;
```

#### Publish OTA Update
```bash
eas update --branch production --message "Hotfix: Critical bug"
```

## Testing

### Test Update Modal
1. Ubah versi di backend menjadi lebih tinggi
2. Buka aplikasi atau klik "Check for Updates"
3. Modal akan muncul dengan info update

### Test Force Update
1. Set `minimum` version di backend lebih tinggi dari current
2. Modal tidak bisa ditutup tanpa update

### Test OTA Update
1. Publish update dengan `eas update`
2. Buka aplikasi
3. Update akan didownload dan app reload otomatis

## Version Strategy

### Semantic Versioning (MAJOR.MINOR.PATCH)
- **MAJOR (1.x.x)**: Breaking changes, force update
- **MINOR (x.1.x)**: New features, optional update
- **PATCH (x.x.1)**: Bug fixes, optional update

### Android versionCode
Increment untuk setiap build:
```json
"android": {
  "versionCode": 7  // Increment this for every new build
}
```

### iOS Build Number
Increment untuk setiap build:
```json
"ios": {
  "buildNumber": "7"  // Increment this for every new build
}
```

## Troubleshooting

### Update Modal tidak muncul
1. Check console log untuk error
2. Pastikan backend API berjalan
3. Pastikan API URL sudah benar
4. Check apakah user sudah skip version ini

### OTA Update tidak work
1. Check `expo-updates` configuration di app.json
2. Pastikan `runtimeVersion` sesuai
3. Check EAS project ID benar
4. Pastikan publish update sukses

### Force Update tidak work
1. Check backend logic untuk `forceUpdate`
2. Pastikan minimum version sudah di-set
3. Check version comparison logic

## Next Steps

1. **Implement Backend Endpoint**: Buat endpoint `/api/app/version-check`
2. **Configure API URL**: Set correct API URL di `.env`
3. **Test**: Test update flow dengan berbagai scenarios
4. **Deploy**: Deploy backend dan test dengan production build
5. **Monitor**: Monitor update adoption rate

## Notes

- Update check dilakukan setiap 6 jam untuk tidak mengganggu user
- User bisa skip optional updates
- Force update tidak bisa di-skip
- OTA updates cocok untuk quick fixes tanpa rebuild
- Store updates diperlukan untuk native code changes

## Resources

- [Expo Updates Documentation](https://docs.expo.dev/versions/latest/sdk/updates/)
- [Expo Application Documentation](https://docs.expo.dev/versions/latest/sdk/application/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
