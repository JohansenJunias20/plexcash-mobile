# Expo Development Troubleshooting Guide

## Common Issues and Solutions

### 1. "Something went wrong" when scanning QR code

**Symptoms:**
- QR code appears in terminal
- Scanning with Expo Go shows "Something went wrong" error
- App fails to load on phone

**Solutions:**

#### A. Update Node.js (Most Important)
```bash
# Check current version
node -v

# Should be 20.0.0 or higher
# Download from: https://nodejs.org/
```

#### B. Update Expo and Dependencies
```bash
# Update Expo to expected version
npx expo install --fix

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### C. Use Tunnel Mode for Network Issues
```bash
# Start with tunnel mode (bypasses network restrictions)
npx expo start --tunnel

# Alternative: Use LAN mode
npx expo start --lan
```

#### D. Clear Expo Cache
```bash
# Clear Expo cache
npx expo start --clear

# Or manually clear cache
rm -rf .expo
```

### 2. Network Connection Issues

**If your phone can't connect to the development server:**

#### A. Check Network Configuration
- Ensure phone and computer are on the same WiFi network
- Disable VPN on both devices
- Check firewall settings (allow port 8081)

#### B. Use Tunnel Mode
```bash
npx expo start --tunnel
```
This creates a public URL that works across different networks.

#### C. Manual IP Configuration
```bash
# Find your computer's IP address
# Windows:
ipconfig

# Mac/Linux:
ifconfig

# Then start with specific host
npx expo start --host 192.168.1.XXX
```

### 3. Expo Go App Issues

#### A. Update Expo Go App
- Update Expo Go app on your phone from App Store/Play Store
- Ensure you're using the latest version

#### B. Clear Expo Go Cache
- In Expo Go app: Settings → Clear Cache
- Or uninstall and reinstall Expo Go

### 4. Development Build vs Expo Go

**If Expo Go doesn't work, try development build:**

```bash
# Create development build
npx expo run:android
# or
npx expo run:ios

# Then use development build instead of Expo Go
npx expo start --dev-client
```

### 5. Firebase/Google Services Issues

**If you have Firebase authentication errors:**

#### A. Check Firebase Configuration
- Ensure `google-services.json` (Android) exists
- Ensure `GoogleService-Info.plist` (iOS) exists
- Verify Firebase project settings

#### B. Check Bundle Identifier
- Ensure app.json bundle identifier matches Firebase project
- Check that your development environment is registered in Firebase

### 6. Metro Bundler Issues

**If Metro bundler fails to start:**

```bash
# Reset Metro cache
npx expo start --clear

# Or manually reset
npx react-native start --reset-cache
```

### 7. Port Conflicts

**If port 8081 is already in use:**

```bash
# Kill processes using port 8081
# Windows:
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:8081 | xargs kill -9

# Or use different port
npx expo start --port 8082
```

## Quick Fix Commands

### Complete Reset (Nuclear Option)
```bash
# Stop all processes
pkill -f expo
pkill -f metro

# Clear all caches
rm -rf node_modules
rm -rf .expo
npm cache clean --force

# Reinstall everything
npm install
npx expo install --fix

# Start fresh
npx expo start --clear --tunnel
```

### Check System Requirements
```bash
# Check Node.js version (should be 20+)
node -v

# Check npm version
npm -v

# Check Expo CLI
npx expo --version

# Check React Native version
npx react-native --version
```

## Environment-Specific Solutions

### Windows Users
- Use Git Bash or PowerShell (not Command Prompt)
- Ensure Windows Defender isn't blocking the development server
- Check Windows Firewall settings for port 8081

### Mac Users
- Ensure Xcode is installed and updated
- Check macOS firewall settings
- Use `sudo` if permission issues occur

### Network Restrictions (Corporate/School)
- Use `--tunnel` mode
- Contact IT to allow port 8081
- Use mobile hotspot as alternative

## Still Having Issues?

1. **Check Expo Status**: https://status.expo.dev/
2. **Expo Documentation**: https://docs.expo.dev/
3. **Community Forums**: https://forums.expo.dev/
4. **GitHub Issues**: https://github.com/expo/expo/issues

## Debug Information to Collect

When reporting issues, include:
- Node.js version (`node -v`)
- npm version (`npm -v`)
- Expo version (`npx expo --version`)
- Operating system
- Phone OS version
- Expo Go app version
- Complete error messages
- Network configuration (WiFi, VPN, etc.)
