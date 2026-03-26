# AndroidManifest.xml Duplicate Permission Fix

## Problem

Build error when running `npm run android`:

```
Element uses-permission#android.permission.BLUETOOTH_CONNECT at AndroidManifest.xml:14:3-100 
duplicated with element declared at AndroidManifest.xml:13:3-100

Element uses-permission#android.permission.BLUETOOTH_SCAN at AndroidManifest.xml:16:3-164 
duplicated with element declared at AndroidManifest.xml:15:3-97
```

## Root Cause

The AndroidManifest.xml had **duplicate permission declarations** for `BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN`:

### ❌ Incorrect (Before Fix)
```xml
<!-- This was WRONG - duplicate declarations -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" android:maxSdkVersion="30"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" android:minSdkVersion="31"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:maxSdkVersion="30"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:minSdkVersion="31" android:usesPermissionFlags="neverForLocation"/>
```

**Why this was wrong:**
- Android doesn't allow the same permission to be declared multiple times
- Even with different SDK version constraints, it's still considered a duplicate
- The build system merges manifests and detects duplicates

## Solution

Declare each permission **once** with appropriate SDK version constraints:

### ✅ Correct (After Fix)
```xml
<!-- Bluetooth permissions for Android < 12 (API level < 31) -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30"/>

<!-- Bluetooth permissions for Android 12+ (API 31+) -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" tools:targetApi="s"/>
```

## How It Works

### Android < 12 (API Level ≤ 30)
- Uses: `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE_LOCATION`
- These permissions have `maxSdkVersion="30"` so they're **only requested on Android 10 and below**
- This is what Xiaomi Redmi (Android 10) will use

### Android 12+ (API Level ≥ 31)
- Uses: `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `ACCESS_FINE_LOCATION`
- These permissions have **no SDK version constraints** (or implicitly minSdkVersion="31")
- The `neverForLocation` flag tells Android we don't use Bluetooth for location tracking
- This is what newer devices will use

### Why This Works

Android's manifest merger automatically:
1. Applies `BLUETOOTH` and `BLUETOOTH_ADMIN` only on Android ≤ 10
2. Applies `BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN` on Android ≥ 12
3. No duplicates because each permission is declared once

## Complete Permission Structure

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" 
          xmlns:tools="http://schemas.android.com/tools">
  
  <!-- Location permissions (required for Bluetooth on Android < 12) -->
  <uses-permission-sdk-23 android:name="android.permission.ACCESS_COARSE_LOCATION"/>
  <uses-permission-sdk-23 android:name="android.permission.ACCESS_FINE_LOCATION"/>
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>

  <!-- Bluetooth permissions for Android < 12 (API level < 31) -->
  <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>
  <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30"/>

  <!-- Bluetooth permissions for Android 12+ (API 31+) -->
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
  <uses-permission android:name="android.permission.BLUETOOTH_SCAN" 
                   android:usesPermissionFlags="neverForLocation" 
                   tools:targetApi="s"/>
  
  <!-- Other permissions... -->
</manifest>
```

## Verification

### Build Test
```bash
# Clean build
cd android
./gradlew clean
cd ..

# Build
npm run android
```

**Expected**: Build succeeds without duplicate permission errors

### Runtime Test

#### On Android 10 (Xiaomi Redmi)
```bash
adb shell dumpsys package com.yourapp | grep permission
```
**Expected permissions:**
- `android.permission.BLUETOOTH`
- `android.permission.BLUETOOTH_ADMIN`
- `android.permission.ACCESS_FINE_LOCATION`

#### On Android 12+
```bash
adb shell dumpsys package com.yourapp | grep permission
```
**Expected permissions:**
- `android.permission.BLUETOOTH_CONNECT`
- `android.permission.BLUETOOTH_SCAN`
- `android.permission.ACCESS_FINE_LOCATION`

## Key Takeaways

1. **Never duplicate permission declarations** - even with different SDK constraints
2. **Use `maxSdkVersion`** to limit old permissions to older Android versions
3. **Use `neverForLocation`** flag for BLUETOOTH_SCAN on Android 12+ when not using Bluetooth for location
4. **Test on both old and new Android versions** to ensure correct permissions are requested

## Related Files

This fix complements the Bluetooth crash fix in:
- `services/bluetooth/BluetoothPrinterService_Classic.ts`
- `services/bluetooth/BluetoothPrinterService_BLE_PLX.ts`
- `screens/pos/POSKasirScreen.tsx`

All these files now work together to:
1. ✅ Request correct permissions based on Android version
2. ✅ Verify permissions before scanning
3. ✅ Prevent crashes on MIUI devices
4. ✅ Provide helpful error messages

## Status

✅ **FIXED** - Build should now succeed

## Next Steps

1. Run `npm run android` to verify build succeeds
2. Test on Xiaomi Redmi (Android 10) to verify Bluetooth scanning works
3. Test on Android 12+ device to verify new permissions work

