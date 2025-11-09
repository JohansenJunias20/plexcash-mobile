# Version Management Guide

## 📊 Version Numbers in Android

Android apps use **two version identifiers**:

### **1. versionCode (Integer)**
- **Purpose**: Internal version number for Google Play Store
- **Format**: Integer (e.g., 1, 2, 3, 8, 9, 10)
- **Requirement**: **Must increase** with every new upload to Play Store
- **Location**: `android/app/build.gradle`
- **Example**: `versionCode 8`

### **2. versionName (String)**
- **Purpose**: User-visible version string
- **Format**: Semantic versioning (e.g., "1.0.0", "1.0.1", "2.1.3")
- **Requirement**: Can be any string, doesn't need to increase
- **Location**: `android/app/build.gradle`
- **Example**: `versionName "1.0.1"`

---

## 🤖 Auto-Increment versionCode

The `build-aab.sh` and `build-aab.ps1` scripts **automatically increment versionCode** every time you build an AAB for production.

### **How it works:**

1. **Read current versionCode** from `android/app/build.gradle`
2. **Increment by 1** (e.g., 8 → 9)
3. **Update build.gradle** with new versionCode
4. **Build AAB** with the new version
5. **Show version info** in build summary

### **Example:**

**Before build:**
```gradle
versionCode 8
versionName "1.0.1"
```

**Run build script:**
```bash
./build-aab.sh
```

**After build:**
```gradle
versionCode 9
versionName "1.0.1"
```

**Output:**
```
✅ Version code incremented: 8 → 9

📦 AAB File Location:
   android/app/build/outputs/bundle/productionRelease/app-production-release.aab

📊 File Details:
   Size: 55.5 MB
   Version: 1.0.1 (Code: 9)
   Created: 2025-11-09 16:30:00
```

---

## 📝 Manual Version Management

### **When to update versionName:**

Update `versionName` manually when you have a **significant release**:

```gradle
// Minor update (bug fixes)
versionName "1.0.1" → "1.0.2"

// Feature update
versionName "1.0.2" → "1.1.0"

// Major update
versionName "1.1.0" → "2.0.0"
```

**Location:** `android/app/build.gradle` line 96

### **When to update versionCode:**

**DON'T update manually!** The build script does this automatically.

But if you need to update manually:
```gradle
versionCode 8 → 9
```

**Location:** `android/app/build.gradle` line 95

---

## 🔄 Version Workflow

### **Typical Release Cycle:**

#### **1. Bug Fix Release:**
```bash
# 1. Update versionName manually (optional)
# Edit android/app/build.gradle:
#   versionName "1.0.1" → "1.0.2"

# 2. Build AAB (versionCode auto-increments)
./build-aab.sh
# versionCode: 8 → 9

# 3. Upload to Play Store
# Upload: app-production-release.aab
```

#### **2. Feature Release:**
```bash
# 1. Update versionName manually
# Edit android/app/build.gradle:
#   versionName "1.0.2" → "1.1.0"

# 2. Build AAB (versionCode auto-increments)
./build-aab.sh
# versionCode: 9 → 10

# 3. Upload to Play Store
# Upload: app-production-release.aab
```

#### **3. OTA Update (No AAB needed):**
```bash
# For JavaScript/TypeScript changes only
./publish-update.sh -m "Fix login bug"

# No versionCode or versionName change needed!
# Users get update instantly via OTA
```

---

## 📋 Version History Tracking

### **Recommended: Keep a CHANGELOG.md**

Create a `CHANGELOG.md` file to track versions:

```markdown
# Changelog

## [1.1.0] - 2025-11-15
### Added
- New payment method support
- Dark mode

### Fixed
- Login validation bug

## [1.0.2] - 2025-11-10
### Fixed
- Crash on startup
- Bluetooth connection issue

## [1.0.1] - 2025-11-09
### Fixed
- Minor UI bugs
```

---

## 🎯 Best Practices

### **1. versionCode:**
- ✅ Let the build script auto-increment
- ✅ Never decrease versionCode
- ✅ Never reuse versionCode
- ❌ Don't skip numbers (but it's okay if you do)

### **2. versionName:**
- ✅ Use semantic versioning (MAJOR.MINOR.PATCH)
- ✅ Update for user-facing releases
- ✅ Keep it simple and readable
- ❌ Don't use special characters

### **3. Build Process:**
- ✅ Always use `build-aab.sh` or `build-aab.ps1` for production builds
- ✅ Commit version changes to git after successful Play Store upload
- ✅ Tag releases in git (e.g., `git tag v1.0.1`)
- ❌ Don't manually edit versionCode

---

## 🔍 Checking Current Version

### **From build.gradle:**
```bash
# PowerShell
Get-Content android\app\build.gradle | Select-String "version"

# Bash
grep "version" android/app/build.gradle
```

### **From installed app:**
```bash
# Using adb
adb shell dumpsys package com.plexcash.mobile | grep version
```

### **From Play Store Console:**
1. Go to Google Play Console
2. Select your app
3. Go to **Release** → **Production**
4. See current version in production

---

## 🐛 Troubleshooting

### **Problem: "Version code 8 has already been used"**

**Cause:** Trying to upload AAB with same versionCode as previous upload.

**Solution:**
```bash
# Build again - script will auto-increment
./build-aab.sh
```

---

### **Problem: "You need to use a different version code"**

**Cause:** versionCode is lower than or equal to the current version in Play Store.

**Solution:**
1. Check current version in Play Store Console
2. Manually set versionCode higher than Play Store version
3. Run build script (it will increment from there)

```gradle
// If Play Store has versionCode 15, set to 15 or higher
versionCode 15
```

Then run:
```bash
./build-aab.sh
# Will increment to 16
```

---

### **Problem: Build script didn't increment versionCode**

**Cause:** Script error or manual edit conflict.

**Solution:**
1. Check `android/app/build.gradle` for syntax errors
2. Make sure versionCode line format is correct:
   ```gradle
   versionCode 8  // ✅ Correct
   versionCode  8 // ❌ Extra space
   versionCode=8  // ❌ No equals sign
   ```
3. Run build script again

---

## 📊 Version Comparison

| Aspect | versionCode | versionName |
|--------|-------------|-------------|
| **Type** | Integer | String |
| **Visible to users** | ❌ No | ✅ Yes |
| **Must increase** | ✅ Yes | ❌ No |
| **Auto-incremented** | ✅ Yes (by script) | ❌ No (manual) |
| **Used by Play Store** | ✅ Yes (for updates) | ✅ Yes (for display) |
| **Format** | 1, 2, 3, ... | "1.0.0", "1.0.1", ... |

---

## 🎉 Summary

**For Production Builds:**
```bash
# 1. Update versionName if needed (manual)
# Edit android/app/build.gradle: versionName "1.0.1" → "1.0.2"

# 2. Build AAB (versionCode auto-increments)
./build-aab.sh

# 3. Upload to Play Store
# The AAB will have:
#   - versionCode: Auto-incremented (e.g., 8 → 9)
#   - versionName: Your manual update (e.g., "1.0.2")
```

**For OTA Updates:**
```bash
# No version changes needed!
./publish-update.sh -m "Fix bug"
```

**Key Takeaway:**
- 🤖 **versionCode**: Automatic (handled by build script)
- ✍️ **versionName**: Manual (update when you want)
- 🚀 **OTA Updates**: No version changes needed

---

Happy versioning! 🎯

