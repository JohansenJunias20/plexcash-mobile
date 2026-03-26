# 📱 Panduan OTA Updates untuk PlexSeller Mobile

## 🎯 Ringkasan Masalah

Setelah menjalankan `publish-update.sh`, aplikasi mobile tidak menerima update karena:

1. **Channel/Branch Mismatch**: Script publish ke branch `production`, tapi aplikasi development menggunakan channel `development`
2. **OTA Updates Tidak Diimplementasikan**: Fungsi `checkForOTAUpdates` hanya placeholder yang selalu return `false`

## ✅ Solusi yang Sudah Diterapkan

### 1. Implementasi OTA Updates
File `services/versionCheck.ts` sudah diupdate dengan implementasi lengkap:
- ✅ Import `expo-updates` module
- ✅ Implementasi `checkForOTAUpdates()` - cek dan download update
- ✅ Implementasi `reloadApp()` - reload app dengan update baru
- ✅ Implementasi `wasJustUpdated()` - deteksi jika app baru saja diupdate

### 2. Konfigurasi Channel untuk Production Build
File konfigurasi channel sudah ditambahkan:
- ✅ `android/app/src/production/res/values/strings.xml` - Channel `production`
- ✅ `android/app/src/development/res/values/strings.xml` - Channel `development`

**PENTING**: Tanpa konfigurasi ini, aplikasi tidak tahu harus connect ke channel mana!

### 3. Cara Menggunakan OTA Updates

## 📋 Langkah-langkah Publish Update

### Opsi 1: Update untuk Development Build (Recommended untuk Testing)

```bash
# Publish update ke channel development
./publish-update.sh --branch development --message "Fix bug login"
```

**Catatan**: Ini akan mengirim update ke semua aplikasi yang diinstall dari build `development`.

### Opsi 2: Update untuk Production Build

```bash
# Publish update ke channel production (default)
./publish-update.sh --message "Update dashboard UI"

# Atau dengan parameter lengkap
./publish-update.sh --branch production --message "Update dashboard UI"
```

**Catatan**: Ini akan mengirim update ke semua aplikasi yang diinstall dari build `production`.

## 🔍 Cara Memverifikasi Update

### 1. Cek Channel Aplikasi yang Terinstall

Aplikasi yang terinstall menggunakan channel sesuai dengan build profile:
- Build `development` → channel `development`
- Build `preview` → channel `preview`
- Build `production` → channel `production`

### 2. Cek Update yang Sudah Dipublish

```bash
# Lihat update di channel development
eas update:list --branch development

# Lihat update di channel production
eas update:list --branch production
```

### 3. Test Update di Aplikasi

1. **Buka aplikasi** yang sudah terinstall
2. **Tunggu 2 detik** - app akan otomatis cek update saat startup
3. **Lihat console log** untuk melihat proses update:
   ```
   [OTA] Checking for updates...
   [OTA] Update available! Downloading...
   [OTA] Update downloaded successfully!
   [OTA] Reloading app with new update...
   ```
4. **App akan reload otomatis** dengan update baru
5. **Modal "Update Success"** akan muncul setelah reload

## 🛠️ Build Aplikasi dengan Channel yang Benar

### Development Build
```bash
# Build development (channel: development)
eas build --profile development --platform android
```

### Production Build
```bash
# Build production (channel: production)
eas build --profile production --platform android
```

## 📊 Monitoring Updates

### Lihat Update Dashboard
```bash
# Buka dashboard Expo
https://expo.dev/accounts/[your-account]/projects/PlexSeller/updates
```

### Lihat Update History
```bash
# Lihat 10 update terakhir di channel development
eas update:list --branch development --limit 10

# Lihat 10 update terakhir di channel production
eas update:list --branch production --limit 10
```

## ⚠️ Catatan Penting

### 1. Runtime Version Harus Sama
Update hanya akan diterima jika `runtimeVersion` sama:
- App: `runtimeVersion: "1.0.8"` (di `app.json`)
- Update: Harus dipublish dari code dengan `runtimeVersion: "1.0.8"`

Jika Anda mengubah native code (dependencies, plugins, dll), Anda harus:
1. Update `runtimeVersion` di `app.json`
2. Build ulang aplikasi (tidak bisa OTA update)

### 2. Development Build vs Production Build
- **Development Build**: Untuk testing, menggunakan channel `development`
- **Production Build**: Untuk user akhir, menggunakan channel `production`

### 3. Update Tidak Muncul di Expo Go
OTA updates **tidak bekerja** di Expo Go. Anda harus menggunakan development build atau production build.

## 🐛 Troubleshooting

### Update Tidak Muncul?

1. **Cek channel aplikasi**:
   - Pastikan aplikasi menggunakan channel yang sama dengan branch yang Anda publish
   - Development build → publish ke `development`
   - Production build → publish ke `production`

2. **Cek runtime version**:
   ```bash
   # Lihat runtime version di app.json
   grep -A 1 "runtimeVersion" app.json
   ```

3. **Cek console log**:
   - Buka aplikasi dan lihat console log
   - Cari log dengan prefix `[OTA]`

4. **Force check update**:
   - Tutup dan buka ulang aplikasi
   - Update akan dicek otomatis setelah 2 detik

5. **Cek update di dashboard**:
   ```bash
   eas update:list --branch development
   ```

### Error "Updates not enabled"?

Ini berarti Anda menjalankan aplikasi di:
- Expo Go (tidak support OTA updates)
- Development build tanpa expo-updates

**Solusi**: Build ulang aplikasi dengan profile yang benar:
```bash
eas build --profile development --platform android
```

## 📝 Contoh Workflow

### Scenario: Fix Bug di Development

```bash
# 1. Fix bug di code
# 2. Test di local

# 3. Publish update ke development
./publish-update.sh --branch development --message "Fix login bug"

# 4. Buka aplikasi development di device
# 5. App akan otomatis download dan reload dengan update baru
# 6. Modal "Update Success" akan muncul
```

### Scenario: Release ke Production

```bash
# 1. Test di development dulu
./publish-update.sh --branch development --message "Test new feature"

# 2. Setelah yakin, publish ke production
./publish-update.sh --branch production --message "Release new feature"

# 3. Semua user production akan menerima update
```

