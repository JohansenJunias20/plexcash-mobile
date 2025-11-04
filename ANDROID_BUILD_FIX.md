# Android Build Fix Summary

## Problem
The Android build was failing with the error:
```
'com.android.library' and 'com.android.application' plugins cannot be applied in the same project.
```

## Root Cause
The `expo-module-gradle-plugin` from `expo-modules-core` was being applied to the main app project by the Expo autolinking system. This plugin is designed for library modules and automatically applies the `com.android.library` plugin, which conflicts with the `com.android.application` plugin already applied to the app.

## Solution Implemented
Created a postinstall script (`scripts/postinstall.js`) that patches the `expo-module-gradle-plugin` to skip applying library-specific configurations when it detects it's being applied to an application project.

The patch modifies three functions in `ProjectConfiguration.kt`:
1. `applyDefaultPlugins()` - Skips applying `com.android.library` plugin if `com.android.application` is already applied
2. `applyDefaultAndroidSdkVersions()` - Skips for application projects
3. `applyPublishing()` - Skips for application projects

## Files Modified
1. **package.json** - Added postinstall script
2. **scripts/postinstall.js** - Created patch script
3. **.npmrc** - Added `legacy-peer-deps=true` to handle peer dependency conflicts

## Current Status
✅ **FIXED**: The gradle plugin conflict is resolved
❌ **NEW ISSUE**: Kotlin compilation errors in expo-modules-core due to React Native 0.76.5 compatibility issues

## Next Steps
The build now fails with Kotlin compilation errors in expo-modules-core:
```
e: Too many arguments for 'fun parse(boxShadow: ReadableMap): BoxShadow?'
e: Unresolved reference 'enableBridgelessArchitecture'
```

### Recommended Solutions (choose one):

**Option 1: Update expo-modules-core (Recommended)**
```bash
npm install expo-modules-core@latest --legacy-peer-deps
```

**Option 2: Downgrade React Native**
```bash
npm install react-native@0.76.0 --legacy-peer-deps
```

**Option 3: Wait for expo-modules-core update**
The expo team is actively working on React Native 0.76.5 compatibility. Check for updates regularly.

## How the Fix Works
The postinstall script runs automatically after `npm install` and patches the gradle plugin source code to make it compatible with both library and application projects. This ensures the fix persists across dependency reinstalls.

## Testing
After applying one of the recommended solutions above, run:
```bash
rm -rf android
npm run android
```

This will regenerate the android folder and attempt a fresh build.

