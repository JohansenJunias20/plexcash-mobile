# Android 10 Permission Fix - Realme/MIUI Force Close

## 🔴 Critical Issue Found

**Error on Realme (Android 10):**
```
❌ [BT-SERVICE-PLX] Permission check error: [Error: Exception in HostFunction: 
Parameter specified as non-null is null: method 
com.facebook.react.modules.permissions.PermissionsModule.checkPermission, 
parameter permission]
```

**Result**: App force closes when scanning for Bluetooth devices

---

## 🔍 Root Cause

The error occurred because we were trying to check/request permissions that **don't exist in React Native's PermissionsAndroid API**:

```typescript
// ❌ WRONG - These constants don't exist in React Native!
PermissionsAndroid.PERMISSIONS.BLUETOOTH        // undefined
PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN  // undefined
```

When we passed `undefined` to `PermissionsAndroid.check()`, it caused a native crash with the error:
> "Parameter specified as non-null is null"

---

## ✅ The Fix

### Key Understanding

On **Android < 12** (API level < 31):
- `BLUETOOTH` and `BLUETOOTH_ADMIN` permissions are **automatically granted** at install time
- They are declared in `AndroidManifest.xml` but **NOT** in React Native's PermissionsAndroid API
- We **only** need to request `ACCESS_FINE_LOCATION` at runtime

On **Android 12+** (API level >= 31):
- `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` **do exist** in PermissionsAndroid API
- These must be requested at runtime
- `ACCESS_FINE_LOCATION` is still required

### Code Changes

#### Before (Caused Crash)
```typescript
// Android < 12
const granted = await PermissionsAndroid.requestMultiple([
  PermissionsAndroid.PERMISSIONS.BLUETOOTH,        // ❌ undefined!
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,  // ❌ undefined!
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
]);
```

#### After (Fixed)
```typescript
// Android < 12
// CRITICAL FIX: On Android < 12, BLUETOOTH and BLUETOOTH_ADMIN are automatically granted
// We only need to request ACCESS_FINE_LOCATION
const granted = await PermissionsAndroid.request(
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  {
    title: 'Location Permission',
    message: 'This app needs location permission to scan for Bluetooth devices.',
    buttonNeutral: 'Ask Me Later',
    buttonNegative: 'Cancel',
    buttonPositive: 'OK',
  }
);

const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
```

---

## 📋 Files Modified

1. **`services/bluetooth/BluetoothPrinterService_BLE_PLX.ts`**
   - Fixed `requestBluetoothPermissions()` method
   - Fixed `checkBluetoothPermissions()` method

2. **`services/bluetooth/BluetoothPrinterService_Classic.ts`**
   - Fixed `requestBluetoothPermissions()` method
   - Fixed `checkBluetoothPermissions()` method

---

## 🧪 Testing

### Expected Behavior on Android 10 (Realme/MIUI)

1. **First Time Scan**:
   - User taps "Scan Devices"
   - Permission dialog appears: "Location Permission"
   - User grants permission
   - Scan starts successfully ✅

2. **Permission Denied**:
   - User denies location permission
   - Error message appears (NOT crash) ✅
   - User can open Settings to grant permission

3. **Normal Operation**:
   - Location permission already granted
   - Scan works immediately ✅

### Test Commands

```bash
# Rebuild the app
npm run android

# Or install directly
adb install -r android\app\build\outputs\apk\development\debug\app-development-debug.apk

# Check logs
adb logcat | findstr "BT-SERVICE"
```

---

## 📊 Permission Matrix

| Android Version | Manifest Permissions | Runtime Permissions | React Native API |
|----------------|---------------------|---------------------|------------------|
| **Android 10** | BLUETOOTH<br/>BLUETOOTH_ADMIN<br/>ACCESS_FINE_LOCATION | ACCESS_FINE_LOCATION | ✅ ACCESS_FINE_LOCATION<br/>❌ BLUETOOTH (undefined)<br/>❌ BLUETOOTH_ADMIN (undefined) |
| **Android 12+** | BLUETOOTH_SCAN<br/>BLUETOOTH_CONNECT<br/>ACCESS_FINE_LOCATION | BLUETOOTH_SCAN<br/>BLUETOOTH_CONNECT<br/>ACCESS_FINE_LOCATION | ✅ All available |

---

## 🎯 Key Takeaways

1. **Not all manifest permissions are available in React Native's PermissionsAndroid API**
2. **Android < 12**: Only request `ACCESS_FINE_LOCATION` at runtime
3. **Android 12+**: Request `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `ACCESS_FINE_LOCATION`
4. **Always check if permission constants exist** before using them
5. **Test on real devices** - emulators may not catch these issues

---

## ✅ Status

- [x] Root cause identified
- [x] Fix implemented in BLE_PLX service
- [x] Fix implemented in Classic service
- [x] No TypeScript errors
- [ ] **Ready for testing on Realme (Android 10)**
- [ ] **Ready for regression testing on Samsung devices**

---

## 📝 Related Issues

- Original issue: Xiaomi Redmi (Android 10) crash
- New issue: Realme (Android 10) force close
- Both caused by same root issue: undefined permission constants

---

## 🚀 Next Steps

1. **Rebuild the app**:
   ```bash
   npm run android
   ```

2. **Test on Realme (Android 10)**:
   - Should NOT crash when scanning
   - Should show location permission dialog
   - Should scan successfully after granting permission

3. **Test on Samsung devices**:
   - Verify no regression
   - All existing functionality should work

4. **Test on Android 12+ device** (if available):
   - Verify new permission flow works
   - Should request BLUETOOTH_SCAN and BLUETOOTH_CONNECT

---

**This fix resolves the force close issue on Android 10 devices (Realme, Xiaomi, MIUI) by only requesting permissions that actually exist in React Native's API.**

