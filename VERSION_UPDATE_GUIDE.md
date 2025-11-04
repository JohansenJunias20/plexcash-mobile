# How to Update App Version

## Update Langkah-Langkah

### 1. Update Version di Backend (Server)

Edit file `Server/index.ts` dan cari bagian `APP_VERSIONS`:

```typescript
const APP_VERSIONS: { [platform: string]: AppVersionConfig } = {
    android: {
        latest: '1.0.2',  // ← Update version di sini
        minimum: '1.0.0',  // ← Minimum version yang didukung
        releaseNotes: '- Bug fixes\n- New features\n- Performance improvements',  // ← Update release notes
        storeUrl: 'https://play.google.com/store/apps/details?id=com.plexcash.mobile'
    },
    ios: {
        latest: '1.0.2',  // ← Update version di sini
        minimum: '1.0.0',
        releaseNotes: '- Bug fixes\n- New features\n- Performance improvements',
        storeUrl: 'https://apps.apple.com/app/plexseller/id123456789'
    }
};
```

### 2. Update Version di Mobile App

Edit file `plexcash-mobile/app.json`:

```json
{
  "expo": {
    "version": "1.0.2",  // ← Update version (semantic versioning)
    "android": {
      "versionCode": 8  // ← Increment untuk setiap build baru
    },
    "ios": {
      "buildNumber": "8"  // ← Increment untuk setiap build baru
    }
  }
}
```

## Tipe Update

### Optional Update (Soft Update)
User bisa skip atau update nanti.

**Kapan digunakan:**
- Bug fixes kecil
- Fitur baru yang tidak critical
- UI improvements

**Cara setting:**
- `latest` version lebih tinggi dari user's version
- `minimum` version tetap di bawah atau sama dengan user's version

Contoh:
```typescript
latest: '1.0.2',    // Version baru
minimum: '1.0.0',   // User dengan 1.0.0 ke atas masih bisa pakai app
```

### Force Update (Hard Update)
User HARUS update untuk bisa pakai app.

**Kapan digunakan:**
- Breaking changes
- Security fixes critical
- API changes yang tidak backward compatible

**Cara setting:**
- `minimum` version dinaikkan
- User dengan version di bawah `minimum` akan dipaksa update

Contoh:
```typescript
latest: '2.0.0',    // Version baru dengan breaking changes
minimum: '2.0.0',   // Force semua user update ke 2.0.0
```

## Release Process

### Step 1: Update Backend Version Config
```typescript
// Server/index.ts
const APP_VERSIONS = {
    android: {
        latest: '1.0.2',
        minimum: '1.0.0',
        releaseNotes: '- Fixed Bluetooth printer issue\n- Improved order sync\n- UI improvements',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.plexcash.mobile'
    }
};
```

### Step 2: Update Mobile App Version
```json
// app.json
{
  "version": "1.0.2",
  "android": {
    "versionCode": 8
  }
}
```

### Step 3: Build & Deploy Mobile App
```bash
# Build APK untuk production
cd plexcash-mobile
eas build --platform android --profile production

# Atau build lokal
npx expo run:android --variant release
```

### Step 4: Upload ke Play Store
1. Login ke Google Play Console
2. Create new release
3. Upload APK/AAB
4. Update release notes (copy dari backend config)
5. Roll out to production

### Step 5: Deploy Backend
```bash
cd Plex-Cash
./deploy.sh
# Atau manual restart server untuk apply changes
```

### Step 6: Test
1. Install app versi lama di device
2. Buka app
3. Modal update harus muncul dengan informasi yang benar
4. Test "Update Sekarang" - harus buka Play Store
5. Test "Skip" dan "Nanti" (untuk optional updates)

## Version Numbering Guide

### Semantic Versioning: MAJOR.MINOR.PATCH

**MAJOR (1.x.x)**
- Breaking changes
- Complete redesign
- Major feature overhaul
- **Action:** Force update

**MINOR (x.1.x)**
- New features (backward compatible)
- Significant improvements
- **Action:** Optional update recommended

**PATCH (x.x.1)**
- Bug fixes
- Small improvements
- Security patches (non-critical)
- **Action:** Optional update

### Android versionCode Rules
- Must be integer
- Must increment for every build (tidak boleh sama atau lebih kecil)
- Play Store uses this to determine which is newer

Contoh:
```
v1.0.0 → versionCode: 1
v1.0.1 → versionCode: 2
v1.0.2 → versionCode: 3
v1.1.0 → versionCode: 4
v2.0.0 → versionCode: 5
```

## Release Notes Best Practices

### Good Release Notes ✅
```typescript
releaseNotes: 
  '- Fixed: Bluetooth printer connection issue\n' +
  '- New: Auto-sync with marketplace every 5 minutes\n' +
  '- Improved: Order list loading speed (50% faster)\n' +
  '- Fixed: App crash when scanning barcode'
```

### Bad Release Notes ❌
```typescript
releaseNotes: 'Bug fixes and improvements'  // Terlalu generic
```

### Template
```typescript
releaseNotes: 
  '🐛 Bug Fixes:\n' +
  '- Fixed printer connection timeout\n' +
  '- Fixed order sync failure\n\n' +
  '✨ New Features:\n' +
  '- Added bulk barcode print\n' +
  '- Added order filter by status\n\n' +
  '⚡ Improvements:\n' +
  '- Faster order loading\n' +
  '- Better error messages'
```

## Quick Reference

### Check Current Settings
```bash
# Check backend version config
cd Plex-Cash/Server
grep -A 10 "APP_VERSIONS" index.ts

# Check mobile app version
cd plexcash-mobile
cat app.json | grep -A 5 "version"
```

### Common Scenarios

#### Scenario 1: Minor Bug Fix
```typescript
// Backend
latest: '1.0.2'     // From 1.0.1
minimum: '1.0.0'    // No change

// Mobile app.json
version: '1.0.2'
versionCode: 8      // From 7
```
Result: Optional update, users can continue using old version

#### Scenario 2: Critical Security Fix
```typescript
// Backend
latest: '1.0.3'
minimum: '1.0.3'    // Force update to this version

// Mobile app.json
version: '1.0.3'
versionCode: 9
```
Result: Force update, users MUST update

#### Scenario 3: Major Version with Breaking Changes
```typescript
// Backend
latest: '2.0.0'
minimum: '2.0.0'    // No backward compatibility

// Mobile app.json
version: '2.0.0'
versionCode: 10
```
Result: Force update to new major version

## Monitoring

### Check Update Adoption
Add logging in backend:
```typescript
app.post("/api/app/version-check", async (req, res) => {
    const { currentVersion, platform } = req.body;
    
    // Log for analytics
    console.log(`[Version Check] ${platform} v${currentVersion}`);
    
    // Optional: Save to database for analytics
    // await db.query('INSERT INTO version_checks ...');
    
    // ... rest of code
});
```

### Analytics to Track
- Number of users on each version
- Update adoption rate
- Time to 50% adoption
- Users still on old versions

## Troubleshooting

### "Update modal tidak muncul"
1. Check API endpoint accessible: `curl https://app.plexseller.com/api/app/version-check`
2. Check console logs di mobile app
3. Pastikan user belum skip version ini
4. Clear app data dan test lagi

### "Force update tidak work"
1. Check `minimum` version di backend
2. Pastikan `compareVersions` function benar
3. Test dengan user version < minimum

### "Version comparison salah"
1. Pastikan format semantic versioning: `1.0.1` bukan `1.0.1.0`
2. Check `compareVersions` function logic
3. Test edge cases: `1.9.0` vs `1.10.0`

## Files to Edit

Setiap kali update version:

1. **Server/index.ts**
   - Update `APP_VERSIONS` config
   - Update release notes

2. **plexcash-mobile/app.json**
   - Update `version`
   - Update `android.versionCode`
   - Update `ios.buildNumber` (jika deploy ke iOS)

3. **Play Store Console**
   - Create new release
   - Upload new APK/AAB
   - Update release notes
   - Roll out

## Next Steps

After implementing in-app updates:
1. ✅ Backend endpoint created
2. ✅ Mobile app checks for updates
3. ✅ Update modal implemented
4. ⏳ Build & upload to Play Store
5. ⏳ Test dengan production build
6. ⏳ Monitor adoption rate
