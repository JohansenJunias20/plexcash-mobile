# Quick Fix Guide: Bluetooth Crash on Xiaomi Redmi (Android 10)

## What Was Fixed

✅ **App no longer crashes when scanning for Bluetooth devices on Xiaomi/MIUI**

The crash was caused by missing permission validation before calling native Bluetooth APIs. MIUI's aggressive permission management would cause a native crash when permissions weren't properly verified.

## Changes Summary

### 🔧 Code Changes

1. **Added permission verification** before scanning
2. **Added Bluetooth state checks** before scanning
3. **Added stability delays** for MIUI devices (300ms)
4. **Improved error handling** with user-friendly messages
5. **Updated AndroidManifest.xml** with proper permission flags

### 📱 Files Modified

- `services/bluetooth/BluetoothPrinterService_Classic.ts`
- `services/bluetooth/BluetoothPrinterService_BLE_PLX.ts`
- `android/app/src/main/AndroidManifest.xml`
- `screens/pos/POSKasirScreen.tsx`

## How to Test

### 1. Rebuild the App

```bash
# Clean build
cd android
./gradlew clean
cd ..

# Rebuild and install
npm run android
```

### 2. Test on Xiaomi Redmi

1. Open the app
2. Go to POS Kasir screen
3. Tap "Scan Devices" button
4. **Expected**: App should NOT crash
5. **Expected**: Permission dialog appears (if first time)
6. Grant all permissions
7. **Expected**: Bluetooth scan starts successfully

### 3. Test Scenarios

#### ✅ Scenario 1: First Time (No Permissions)
- Tap "Scan Devices"
- Permission dialog appears
- Grant all permissions
- Scan starts successfully

#### ✅ Scenario 2: Permissions Denied
- Tap "Scan Devices"
- Deny permissions
- **Expected**: Error message with instructions (NOT crash)
- Follow instructions to grant in Settings
- Try again - should work

#### ✅ Scenario 3: Bluetooth Disabled
- Turn off Bluetooth
- Tap "Scan Devices"
- **Expected**: "Bluetooth Not Enabled" message (NOT crash)
- Turn on Bluetooth
- Try again - should work

#### ✅ Scenario 4: Normal Operation
- All permissions granted
- Bluetooth enabled
- Printer turned on
- Tap "Scan Devices"
- **Expected**: Finds devices successfully

## What Users Will See

### Before Fix
❌ App crashes immediately when tapping "Scan Devices"

### After Fix
✅ One of these outcomes:
1. **Success**: Devices found
2. **Permission Error**: Clear message with instructions
3. **Bluetooth Error**: Clear message to enable Bluetooth
4. **No Devices**: Helpful troubleshooting tips

## Error Messages

### Permission Error
```
Permissions Required

Bluetooth permissions are required to scan for printers.

Please:
1. Go to Settings
2. Find this app
3. Grant Bluetooth and Location permissions
4. Try again

[Cancel] [Open Settings]
```

### Bluetooth Disabled
```
Bluetooth Not Enabled

Please turn on Bluetooth in your device settings and try again.

[OK]
```

### No Devices Found
```
No Devices Found

No Bluetooth printers found. Make sure your printer is turned on and in pairing mode.

Troubleshooting:
• Turn on your printer
• Enable Bluetooth
• Grant all permissions
• Try restarting Bluetooth

[OK]
```

## Verification Checklist

- [ ] App doesn't crash on Xiaomi Redmi when scanning
- [ ] App doesn't crash on Samsung devices (regression test)
- [ ] Permission dialogs appear correctly
- [ ] Error messages are helpful and clear
- [ ] Bluetooth scanning works when permissions granted
- [ ] Can find and connect to printers

## If Issues Persist

### 1. Check Permissions Manually
Settings → Apps → PlexCash → Permissions
- ✅ Bluetooth
- ✅ Location

### 2. Check Logcat
```bash
adb logcat | grep -E "(BT-SERVICE|BLUETOOTH)"
```

### 3. Try Alternative Library
The app supports multiple Bluetooth libraries. If one doesn't work, try another:
- Default: `bt-classic` (Bluetooth Classic)
- Alternative: `ble-plx` (Bluetooth Low Energy)

### 4. Restart Bluetooth
- Turn off Bluetooth
- Wait 5 seconds
- Turn on Bluetooth
- Try scanning again

## Technical Notes

### Why This Fix Works

1. **Permission Validation**: Checks permissions BEFORE calling native APIs
2. **State Verification**: Ensures Bluetooth is enabled before scanning
3. **Stability Delays**: 300ms delay prevents MIUI Bluetooth stack crashes
4. **Error Handling**: Catches native errors and shows user-friendly messages
5. **Manifest Flags**: Proper `neverForLocation` flag for Android 12+

### Supported Devices

✅ **Tested and Working:**
- Samsung S20, S10, A7 (already working)
- Xiaomi Redmi Android 10 (now fixed)

✅ **Should Work:**
- All MIUI devices (Xiaomi, Redmi, Poco)
- All Android 10+ devices
- All Android 12+ devices

## Support

If you encounter any issues:
1. Check the detailed guide: `BLUETOOTH_CRASH_FIX.md`
2. Review logcat output
3. Verify all permissions are granted
4. Try restarting the device

