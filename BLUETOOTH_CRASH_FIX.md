# Bluetooth Scanning Crash Fix for Xiaomi/MIUI Devices

## Problem Summary

The app was crashing immediately when scanning for Bluetooth devices on **Xiaomi Redmi (Android 10/MIUI)** devices. The crash occurred with both:
- `react-native-bluetooth-classic` (BT Classic)
- `react-native-ble-plx` (BLE)

The app worked fine on Samsung devices (S20, S10, A7) but crashed on MIUI devices.

## Root Cause

The crash was caused by **missing permission validation** before calling native Bluetooth scanning APIs. MIUI has aggressive permission management and will cause a native crash if:

1. Permissions are not explicitly verified before scanning
2. Permissions were denied but the app tries to scan anyway
3. Location services are required but not properly requested

## Changes Made

### 1. **BluetoothPrinterService_Classic.ts**

#### Added Permission Checking Method
```typescript
async checkBluetoothPermissions(): Promise<boolean>
```
- Verifies all required permissions are granted before scanning
- Checks different permissions based on Android version (< 12 vs >= 12)

#### Enhanced Permission Request
- Added explicit logging when permissions are denied
- Returns clear boolean indicating success/failure

#### Improved scanDevices() Method
- **CRITICAL FIX**: Checks permissions before calling `startDiscovery()`
- Verifies Bluetooth is enabled before scanning
- Cancels any existing discovery before starting new scan (MIUI stability fix)
- Added 300ms delay before starting scan (MIUI stability)
- Better error handling with user-friendly messages

### 2. **BluetoothPrinterService_BLE_PLX.ts**

#### Same improvements as Classic service:
- Added `checkBluetoothPermissions()` method
- Enhanced permission validation
- Pre-scan permission and Bluetooth state checks
- Added 300ms delay before starting BLE scan (MIUI stability)
- Wrapped `startDeviceScan()` in try-catch to prevent native crashes
- Better error messages for permission and Bluetooth state issues

### 3. **AndroidManifest.xml**

#### Updated Bluetooth Permissions
```xml
<!-- Android 12+ with neverForLocation flag -->
<uses-permission 
  android:name="android.permission.BLUETOOTH_SCAN" 
  android:minSdkVersion="31" 
  android:usesPermissionFlags="neverForLocation" 
  tools:targetApi="s"/>
```

**Why this matters:**
- The `neverForLocation` flag tells Android we don't use Bluetooth for location tracking
- This can help with permission grants on some devices
- Properly separates Android < 12 and >= 12 permission requirements

### 4. **POSKasirScreen.tsx**

#### Enhanced Error Handling
- Better error messages based on error type
- Specific guidance for permission errors
- Option to open Settings directly for permission grants
- Troubleshooting tips in error dialogs

## Testing Instructions

### Test on Xiaomi Redmi (Android 10)

1. **Clean Install Test**
   ```bash
   # Uninstall the app completely
   adb uninstall com.yourapp
   
   # Rebuild and install
   npm run android
   ```

2. **Permission Denial Test**
   - Deny permissions when first prompted
   - Try to scan for Bluetooth devices
   - Should show helpful error message (not crash)
   - Follow instructions to grant permissions in Settings
   - Try scanning again - should work

3. **Bluetooth Disabled Test**
   - Turn off Bluetooth
   - Try to scan
   - Should show "Bluetooth Not Enabled" message (not crash)
   - Turn on Bluetooth
   - Try scanning again - should work

4. **Normal Scan Test**
   - Grant all permissions
   - Enable Bluetooth
   - Turn on a Bluetooth printer
   - Tap "Scan Devices"
   - Should find devices without crashing

### Test on Samsung Devices (Regression Test)

Verify the fix doesn't break existing functionality:
- Test on Samsung S20, S10, A7
- All scanning should still work as before

## Technical Details

### Permission Flow (Android 10)

```
1. User taps "Scan Devices"
2. checkBluetoothPermissions() verifies:
   - BLUETOOTH
   - BLUETOOTH_ADMIN
   - ACCESS_FINE_LOCATION
3. If any missing → requestBluetoothPermissions()
4. If denied → Show error, don't scan
5. If granted → Check Bluetooth enabled
6. If disabled → Show error, don't scan
7. If enabled → Cancel existing discovery
8. Wait 300ms (MIUI stability)
9. Start discovery
10. Scan for 5 seconds
11. Stop discovery
12. Return devices
```

### Why 300ms Delay?

MIUI devices have been observed to crash when:
- Starting scan immediately after permission grant
- Starting scan immediately after stopping previous scan
- Rapid successive scan operations

The 300ms delay gives the Bluetooth stack time to stabilize.

## Troubleshooting

### If Still Crashing

1. **Check Logcat**
   ```bash
   adb logcat | grep -i bluetooth
   ```

2. **Verify Permissions in Settings**
   - Settings → Apps → Your App → Permissions
   - Ensure Bluetooth and Location are granted

3. **Try Different Library**
   ```typescript
   // Switch from bt-classic to ble-plx
   await BluetoothPrinterServiceFactory.switchLibrary('ble-plx');
   ```

4. **Check MIUI Version**
   - Some MIUI versions have known Bluetooth bugs
   - Consider updating MIUI if possible

## Related Issues

- MIUI aggressive permission management
- Android 10 Bluetooth permission requirements
- Native module crashes on permission denial
- BLE stack stability on custom Android ROMs

## References

- [Android Bluetooth Permissions](https://developer.android.com/guide/topics/connectivity/bluetooth/permissions)
- [MIUI Permission Management](https://xiaomi.eu/community/threads/miui-permission-management.50739/)

