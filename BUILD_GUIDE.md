# PlexCash Mobile - Build Guide

## 📦 Product Flavors

Project ini menggunakan **2 product flavors** untuk memungkinkan development dan production app berjalan bersamaan di device yang sama:

### **1. Production Flavor**
- **Package Name**: `com.plexcash.mobile`
- **App Name**: `PlexSeller`
- **Use Case**: Production build untuk upload ke Google Play Store
- **Keystore**: Production keystore (`@johansenjunias__plexcash-mobile.jks`)

### **2. Development Flavor**
- **Package Name**: `com.plexcash.mobile.dev`
- **App Name**: `PlexSeller DEV`
- **Use Case**: Development build untuk USB debugging
- **Keystore**: Debug keystore (Android default)
- **Version Suffix**: `-dev` (e.g., `1.0.1-dev`)

---

## 🚀 Building AAB (Production)

### **For Google Play Store Upload:**

**PowerShell:**
```powershell
.\build-aab.ps1
```

**Bash:**
```bash
./build-aab.sh
```

**What the script does:**
1. ✅ **Auto-increments versionCode** (required by Play Store)
2. ✅ Stops Gradle daemon
3. ✅ Cleans previous build
4. ✅ Builds production AAB with production keystore
5. ✅ Shows file size and version info
6. ✅ Optional: Copy to Desktop with version in filename

**Output:**
- File: `android/app/build/outputs/bundle/productionRelease/app-production-release.aab`
- Signed with: Production keystore
- Version code: **Automatically incremented** (e.g., 8 → 9)
- Ready to upload to Google Play Store

**Important:** The script automatically increments `versionCode` in `android/app/build.gradle` every time you run it. This ensures Google Play Store accepts the new AAB.

---

## 🔧 Development Workflow

### **Option 1: Run Development Flavor (Recommended)**

**Start Metro bundler:**
```bash
npm start
```

**In another terminal, run development build:**
```bash
# Android
npx react-native run-android --mode=developmentDebug

# Or using Expo
npx expo run:android --variant developmentDebug
```

**Benefits:**
- ✅ Can install alongside production app from Play Store
- ✅ Different app icon name (`PlexSeller DEV`)
- ✅ Different package name (`com.plexcash.mobile.dev`)
- ✅ No conflicts!

---

### **Option 2: Uninstall Production App (Not Recommended)**

If you want to test production flavor during development:

```bash
# Uninstall production app from device
adb uninstall com.plexcash.mobile

# Run production debug build
npx react-native run-android --mode=productionDebug
```

**Drawbacks:**
- ❌ Need to uninstall production app first
- ❌ Lose production app data
- ❌ Need to reinstall from Play Store later

---

## 📱 Installing on Device

### **Development Build (USB Debug):**

1. **Connect device via USB**
2. **Enable USB debugging** on device
3. **Run development build:**
   ```bash
   npx expo run:android --variant developmentDebug
   ```
4. **App will install** as `PlexSeller DEV` with package `com.plexcash.mobile.dev`

### **Production Build (From Play Store):**

1. **Build AAB:**
   ```bash
   ./build-aab.sh
   ```
2. **Upload to Google Play Console**
3. **User downloads** from Play Store as `PlexSeller` with package `com.plexcash.mobile`

---

## 🔄 OTA Updates (Expo Updates)

### **Publish Update:**

**PowerShell:**
```powershell
.\publish-update.ps1 -Message "Fix login bug"
```

**Bash:**
```bash
./publish-update.sh -m "Fix login bug"
```

### **How it Works:**

1. **Both flavors** (production & development) use the **same Expo project ID**
2. **OTA updates** work for both flavors
3. **Users receive updates** when they open the app
4. **No need** to upload new AAB to Play Store for JavaScript/TypeScript changes

---

## 🎯 When to Use What?

| Scenario | Command | Flavor |
|----------|---------|--------|
| **Daily development** | `npx expo run:android --variant developmentDebug` | Development |
| **Test on device** | `npx expo run:android --variant developmentDebug` | Development |
| **Build for Play Store** | `./build-aab.sh` | Production |
| **Quick bug fix** | `./publish-update.sh -m "Fix bug"` | Both (OTA) |
| **Update native code** | `./build-aab.sh` → Upload to Play Store | Production |

---

## 🔑 Keystore Information

### **Production Keystore:**
- **File**: `@johansenjunias__plexcash-mobile.jks` (in project root)
- **Config**: `android/keystore.properties`
- **Used for**: Production AAB builds
- **Downloaded from**: EAS credentials

### **Debug Keystore:**
- **File**: `android/app/debug.keystore`
- **Password**: `android`
- **Alias**: `androiddebugkey`
- **Used for**: Development builds

---

## 📊 Build Variants

Gradle generates these build variants:

| Variant | Flavor | Build Type | Package Name | App Name | Use Case |
|---------|--------|------------|--------------|----------|----------|
| `productionDebug` | production | debug | `com.plexcash.mobile` | PlexSeller | Testing production flavor |
| `productionRelease` | production | release | `com.plexcash.mobile` | PlexSeller | **Play Store upload** |
| `developmentDebug` | development | debug | `com.plexcash.mobile.dev` | PlexSeller DEV | **Daily development** |
| `developmentRelease` | development | release | `com.plexcash.mobile.dev` | PlexSeller DEV | Testing dev release |

---

## 🛠️ Gradle Tasks

### **Build AAB:**
```bash
cd android

# Production AAB (for Play Store)
./gradlew bundleProductionRelease

# Development AAB (for testing)
./gradlew bundleDevelopmentRelease
```

### **Build APK:**
```bash
cd android

# Production APK
./gradlew assembleProductionRelease

# Development APK
./gradlew assembleDevelopmentRelease
```

### **Install to Device:**
```bash
cd android

# Install development debug build
./gradlew installDevelopmentDebug

# Install production debug build
./gradlew installProductionDebug
```

---

## 🐛 Troubleshooting

### **Problem: "App not installed" error**

**Cause:** Trying to install development build when production app from Play Store is already installed (or vice versa).

**Solution:**
- Use **development flavor** for USB debugging: `npx expo run:android --variant developmentDebug`
- This allows both apps to coexist!

---

### **Problem: "Duplicate resources" error**

**Cause:** `app_name` defined in both `strings.xml` and `build.gradle`.

**Solution:**
- Remove `app_name` from `android/app/src/main/res/values/strings.xml`
- It's now defined in `build.gradle` via `resValue`

---

### **Problem: Build fails with "keystore not found"**

**Cause:** Production keystore file missing or path incorrect.

**Solution:**
1. Download keystore from EAS:
   ```bash
   eas credentials -p android
   ```
2. Make sure `android/keystore.properties` has correct path:
   ```properties
   PLEXCASH_UPLOAD_STORE_FILE=../../@johansenjunias__plexcash-mobile.jks
   ```

---

## 📝 Summary

**For Development:**
```bash
# Run development build (can coexist with Play Store app)
npx expo run:android --variant developmentDebug
```

**For Production:**
```bash
# Build AAB for Play Store
./build-aab.sh

# Publish OTA update (no Play Store upload needed)
./publish-update.sh -m "Fix bug"
```

**Key Benefits:**
- ✅ Development and production apps can **coexist** on same device
- ✅ No need to uninstall production app for development
- ✅ Clear visual distinction (app name: `PlexSeller` vs `PlexSeller DEV`)
- ✅ OTA updates work for both flavors
- ✅ Production builds use production keystore automatically

---

## 🎉 Happy Coding!

For questions or issues, check the troubleshooting section above or contact the development team.

