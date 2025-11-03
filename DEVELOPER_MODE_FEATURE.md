# Developer Mode Feature

## Overview

The PlexCash mobile app now includes a comprehensive **Developer Mode** feature that allows developers to view real-time logs directly within the app. This is especially useful for debugging issues in production APK builds where traditional debugging tools may not be available.

---

## Features

### ✅ Developer Mode Toggle
- **Location**: Available on both LoginScreen and MainScreen
- **Visual Indicator**: Bug icon button with green indicator when enabled
- **Persistence**: State persists across app restarts using AsyncStorage

### ✅ Real-Time Log Viewer
- **Floating Overlay**: Non-intrusive modal that can be minimized
- **Real-Time Updates**: Logs appear instantly as they're generated
- **Auto-Scroll**: Automatically scrolls to newest logs (can be disabled)
- **Color-Coded Levels**: Different colors for DEBUG, INFO, WARN, ERROR, CRITICAL
- **Context Tags**: Shows log context (AUTH, NAVIGATION, GOOGLE-AUTH, etc.)
- **Timestamps**: Each log entry includes precise timestamp

### ✅ Log Management
- **Clear Logs**: Remove all logs with confirmation dialog
- **Copy to Clipboard**: Copy all logs as text
- **Share Logs**: Export logs via system share dialog
- **Buffer Size**: Stores up to 500 most recent log entries

### ✅ Production-Safe Logging
- Works in both development and production builds
- Uses multiple console methods to bypass React Native log stripping
- Integrates with existing logger utility (`utils/logger.ts`)

---

## How to Use

### Enabling Developer Mode

#### On Login Screen
1. Open the PlexCash mobile app
2. Look for the **bug icon button** in the top-right corner
3. Tap the button to enable developer mode
4. A **green indicator** appears on the button when enabled
5. The log viewer will appear at the bottom of the screen

#### On Main Screen
1. After logging in, navigate to the MainScreen
2. Look for the **bug icon button** in the bottom-right corner
3. Tap the button to toggle developer mode on/off
4. The log viewer appears when enabled

### Using the Log Viewer

#### Viewing Logs
- Logs appear in real-time as events occur in the app
- Each log entry shows:
  - **Icon**: Emoji representing log level (🔍 DEBUG, ℹ️ INFO, ⚠️ WARNING, ❌ ERROR, 🚨 CRITICAL)
  - **Level**: Color-coded log level
  - **Context**: Tag showing which part of the app generated the log
  - **Timestamp**: Time when the log was created
  - **Message**: The log message
  - **Data**: Additional data (if any), formatted as JSON

#### Minimizing the Log Viewer
1. Tap the **minimize button** (−) in the header
2. The log viewer collapses to a floating button
3. The button shows the current log count
4. Tap the floating button to restore the log viewer

#### Managing Logs

**Clear Logs:**
1. Tap the **Clear** button in the footer
2. Confirm the action in the dialog
3. All logs are removed

**Copy Logs:**
1. Tap the **Copy** button in the footer
2. All logs are copied to clipboard as text
3. Paste into any text editor or messaging app

**Share Logs:**
1. Tap the **Share** button in the footer
2. System share dialog appears
3. Share logs via email, messaging apps, etc.

**Auto-Scroll:**
- **Lock icon** (green): Auto-scroll is enabled
- **Unlock icon** (gray): Auto-scroll is disabled
- Tap the **Bottom** button to scroll to the latest logs and re-enable auto-scroll
- Auto-scroll automatically disables when you manually scroll

---

## Technical Implementation

### Architecture

```
App.tsx
├── DeveloperModeProvider (Context)
│   ├── Manages developer mode state
│   └── Persists state in AsyncStorage
├── AuthProvider
└── AppContent
    ├── NavigationContainer
    │   └── RootNavigator
    │       ├── LoginScreen (with dev mode toggle)
    │       └── MainScreen (with dev mode toggle)
    └── LogViewer (conditionally rendered)
```

### Files Created

1. **`context/DeveloperModeContext.tsx`**
   - React Context for managing developer mode state
   - Provides `isDeveloperMode`, `toggleDeveloperMode`, `enableDeveloperMode`, `disableDeveloperMode`
   - Persists state in AsyncStorage with key `developer_mode_enabled`

2. **`components/LogViewer.tsx`**
   - Floating log viewer component
   - Subscribes to logger events for real-time updates
   - Features: minimize, clear, copy, share, auto-scroll
   - Responsive design with color-coded log levels

### Files Modified

1. **`utils/logger.ts`**
   - Added `LogEntry` interface for structured log data
   - Added event emitter functionality with `subscribe()` method
   - Changed buffer from `string[]` to `LogEntry[]`
   - Added `getBufferedLogsAsStrings()` for backward compatibility
   - Increased buffer size from 100 to 500 entries

2. **`components/LoginScreen.tsx`**
   - Imported `useDeveloperMode` hook
   - Added floating developer mode toggle button (top-right)
   - Button shows green indicator when enabled

3. **`components/MainScreen.tsx`**
   - Imported `useDeveloperMode` hook
   - Added floating developer mode toggle button (bottom-right)
   - Button shows green indicator when enabled

4. **`App.tsx`**
   - Wrapped app in `DeveloperModeProvider`
   - Created `AppContent` component to use `useDeveloperMode` hook
   - Conditionally renders `LogViewer` when developer mode is enabled

---

## Log Levels and Colors

| Level | Icon | Color | Usage |
|-------|------|-------|-------|
| **DEBUG** | 🔍 | Blue (#60A5FA) | Detailed debugging information |
| **INFO** | ℹ️ | Green (#34D399) | General informational messages |
| **WARN** | ⚠️ | Yellow (#FBBF24) | Warning messages |
| **ERROR** | ❌ | Red (#F87171) | Error messages |
| **CRITICAL** | 🚨 | Dark Red (#DC2626) | Critical errors requiring immediate attention |

---

## Log Contexts

The logger provides specialized methods for different contexts:

| Context | Method | Usage |
|---------|--------|-------|
| **AUTH** | `logAuth()` | Authentication flow events |
| **NAVIGATION** | `logNavigation()` | Navigation events |
| **GOOGLE-AUTH** | `logGoogleAuth()` | Google OAuth flow events |
| **STATE-CHANGE** | `logStateChange()` | State change events |

---

## Example Usage

### In Your Code

```typescript
import { logAuth, logNavigation, logGoogleAuth, logError } from '../utils/logger';

// Authentication logs
logAuth('User login successful', { email: 'user@example.com' });

// Navigation logs
logNavigation('Navigating to MainScreen');

// Google OAuth logs
logGoogleAuth('Step 1: Initiating OAuth flow');

// Error logs
logError('Failed to fetch data', { 
  context: 'API', 
  data: { endpoint: '/api/users', error: 'Network error' } 
});
```

### What Users See

When developer mode is enabled, users will see logs like:

```
🔐 [AUTH] User login successful
   Email: user@example.com
   
🧭 [NAVIGATION] Navigating to MainScreen

🔍 [GOOGLE-AUTH] Step 1: Initiating OAuth flow

❌ [API] Failed to fetch data
   {"endpoint":"/api/users","error":"Network error"}
```

---

## Debugging Google OAuth Issues

The developer mode is particularly useful for debugging Google OAuth login issues:

### Expected Log Flow

1. **Step 1-7**: OAuth initialization
   - Device ID generation
   - Session creation
   - CSRF token generation
   - OAuth URL construction

2. **Step 8-14**: OAuth callback
   - Code exchange
   - Token verification
   - Firebase authentication

3. **Step 15-21**: State propagation
   - AsyncStorage updates
   - State changes
   - Navigation triggers

4. **Step 22-25**: Navigation completion
   - RootNavigator re-render
   - MainScreen display

### Troubleshooting

If logs stop at a specific step, you can identify the exact point of failure:

- **Stops at Step 7**: OAuth URL issue
- **Stops at Step 14**: Firebase authentication issue
- **Stops at Step 21**: State propagation issue
- **Stops at Step 24**: Navigation issue

---

## Performance Considerations

### Memory Usage
- Log buffer limited to 500 entries
- Oldest logs automatically removed when buffer is full
- Each log entry is ~200-500 bytes
- Total memory usage: ~100-250 KB

### Performance Impact
- Minimal impact on app performance
- Event emitter uses efficient listener pattern
- Logs are buffered in memory (no disk I/O)
- UI updates are batched via React state

### Production Builds
- Developer mode is OFF by default
- Logs are still captured in background (for debugging)
- No performance impact when developer mode is disabled
- Log viewer only renders when enabled

---

## Security Considerations

### Sensitive Data
⚠️ **Warning**: Logs may contain sensitive information such as:
- User email addresses
- Authentication tokens (partially masked)
- API endpoints
- Error messages with stack traces

**Best Practices:**
- Only enable developer mode when debugging
- Don't share logs publicly without reviewing content
- Clear logs before sharing device with others
- Disable developer mode in production for end users

### Data Persistence
- Developer mode state persists in AsyncStorage
- Logs are stored in memory only (not persisted to disk)
- Logs are cleared when app is closed
- No logs are sent to external servers

---

## Troubleshooting

### Developer Mode Button Not Visible
- Check that you're on LoginScreen or MainScreen
- Look for the bug icon button (top-right on Login, bottom-right on Main)
- Button may be hidden behind other UI elements

### Logs Not Appearing
1. Verify developer mode is enabled (green indicator on button)
2. Check that logger is being used in the code
3. Try clearing logs and triggering the action again
4. Check console for any errors

### Log Viewer Not Opening
1. Tap the developer mode button to toggle it off and on
2. Restart the app
3. Check for JavaScript errors in the console

### Logs Disappearing
- Log buffer is limited to 500 entries
- Oldest logs are automatically removed
- Copy or share logs before they're removed

---

## Future Enhancements

Potential improvements for future versions:

- [ ] Filter logs by level (show only errors, warnings, etc.)
- [ ] Filter logs by context (show only AUTH logs, etc.)
- [ ] Search functionality within logs
- [ ] Export logs to file
- [ ] Remote log streaming to development server
- [ ] Log statistics (count by level, context, etc.)
- [ ] Performance metrics (memory usage, render time, etc.)
- [ ] Network request logging
- [ ] Redux state logging (if Redux is added)

---

## Related Documentation

- [GOOGLE_LOGIN_DEBUG_GUIDE.md](./GOOGLE_LOGIN_DEBUG_GUIDE.md) - Google OAuth debugging guide
- [GOOGLE_2FA_DEVICE_TRUST_FIX.md](./GOOGLE_2FA_DEVICE_TRUST_FIX.md) - 2FA device trust fix
- [GOOGLE_OAUTH_REDIRECT_LOOP_FIX.md](./GOOGLE_OAUTH_REDIRECT_LOOP_FIX.md) - OAuth redirect loop fix
- [utils/logger.ts](./utils/logger.ts) - Logger implementation

---

## Support

If you encounter any issues with the developer mode feature:

1. Check this documentation for troubleshooting steps
2. Review the console logs for errors
3. Try disabling and re-enabling developer mode
4. Restart the app
5. Contact the development team with:
   - Steps to reproduce the issue
   - Screenshots of the log viewer
   - Exported logs (if applicable)

---

**Last Updated**: 2025-10-30
**Version**: 1.0.0
**Author**: Augment Agent

