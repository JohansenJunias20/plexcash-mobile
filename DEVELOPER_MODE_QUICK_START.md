# Developer Mode - Quick Start Guide

## 🚀 Quick Start (30 seconds)

### Enable Developer Mode

**On Login Screen:**
1. Open PlexCash mobile app
2. Tap the **bug icon** (top-right corner)
3. ✅ Green indicator appears = Developer mode ON

**On Main Screen:**
1. After login, tap the **bug icon** (bottom-right corner)
2. ✅ Green indicator appears = Developer mode ON

### View Logs

When developer mode is enabled:
- Log viewer appears automatically at the bottom
- Logs update in real-time
- Color-coded by severity (blue=debug, green=info, yellow=warn, red=error)

### Manage Logs

**Minimize:** Tap the **−** button → Logs collapse to floating button

**Clear:** Tap **Clear** → Confirm → All logs removed

**Copy:** Tap **Copy** → Logs copied to clipboard

**Share:** Tap **Share** → Share via email, messaging, etc.

**Scroll to Bottom:** Tap **Bottom** → Jump to latest logs

---

## 🎯 Common Use Cases

### Debugging Google Login Issues

1. Enable developer mode on Login screen
2. Tap "Login with Google"
3. Watch logs in real-time
4. Look for errors or where logs stop
5. Copy/share logs for troubleshooting

**Expected log flow:**
```
🔍 [GOOGLE-AUTH] Step 1: Getting device ID...
🔍 [GOOGLE-AUTH] Step 2: Initializing OAuth session...
🔍 [GOOGLE-AUTH] Step 3: Generating CSRF token...
...
✅ [AUTH] Authentication successful!
🧭 [NAVIGATION] Navigating to MainScreen
```

### Debugging Navigation Issues

1. Enable developer mode
2. Navigate through the app
3. Watch for navigation logs
4. Check if state changes are logged
5. Identify where navigation fails

### Debugging API Errors

1. Enable developer mode
2. Trigger the API call
3. Look for error logs (red ❌)
4. Check the error data (JSON)
5. Copy logs for bug report

---

## 📊 Log Levels

| Icon | Level | Color | When to Use |
|------|-------|-------|-------------|
| 🔍 | DEBUG | Blue | Detailed debugging info |
| ℹ️ | INFO | Green | General information |
| ⚠️ | WARN | Yellow | Warnings |
| ❌ | ERROR | Red | Errors |
| 🚨 | CRITICAL | Dark Red | Critical failures |

---

## 🔧 Troubleshooting

### "No logs appearing"
- ✅ Check developer mode is ON (green indicator)
- ✅ Trigger the action you want to debug
- ✅ Scroll down in log viewer

### "Log viewer not opening"
- ✅ Toggle developer mode OFF then ON
- ✅ Restart the app

### "Logs disappeared"
- ✅ Buffer holds 500 logs max
- ✅ Copy/share logs before they're removed

### "Can't find developer mode button"
- ✅ Login screen: Top-right corner
- ✅ Main screen: Bottom-right corner
- ✅ Look for bug icon 🐛

---

## 💡 Pro Tips

1. **Auto-scroll**: Disable auto-scroll (tap lock icon) to review old logs without jumping to bottom

2. **Context filtering**: Look for context tags like `[AUTH]`, `[NAVIGATION]`, `[GOOGLE-AUTH]` to find relevant logs

3. **Timestamps**: Use timestamps to measure time between events

4. **Share logs**: When reporting bugs, always share logs via the Share button

5. **Clear regularly**: Clear logs before testing to avoid confusion with old logs

---

## 🔒 Security Warning

⚠️ **Logs may contain sensitive information:**
- User email addresses
- Authentication tokens
- API endpoints
- Error messages

**Best practices:**
- Only enable when debugging
- Clear logs before sharing device
- Review logs before sharing publicly
- Disable in production for end users

---

## 📱 Screenshots

### Developer Mode Button (Login Screen)
```
┌─────────────────────────────┐
│                    [🐛]     │ ← Bug icon (top-right)
│                             │
│     Plex Seller             │
│                             │
│  [Login with QR Code]       │
│  [Login with Google]        │
│                             │
└─────────────────────────────┘
```

### Developer Mode Button (Main Screen)
```
┌─────────────────────────────┐
│  Welcome!                   │
│  user@example.com           │
│                             │
│  [Quick Actions]            │
│  [Barang] [Orders]          │
│                             │
│                             │
│                    [🐛]     │ ← Bug icon (bottom-right)
└─────────────────────────────┘
```

### Log Viewer (Expanded)
```
┌─────────────────────────────┐
│ 🖥️ Developer Logs [25]      │
│ [🔒] [−] [×]                │
├─────────────────────────────┤
│ 🔍 DEBUG [AUTH] 10:30:15    │
│ User login initiated        │
│                             │
│ ℹ️ INFO [GOOGLE-AUTH] 10:30:16│
│ OAuth flow started          │
│                             │
│ ✅ INFO [AUTH] 10:30:18     │
│ Login successful            │
│ {"email":"user@example.com"}│
├─────────────────────────────┤
│ [Clear] [Copy] [Share] [⬇️] │
└─────────────────────────────┘
```

### Log Viewer (Minimized)
```
┌─────────────────────────────┐
│                             │
│                             │
│                             │
│                             │
│                             │
│                      ┌───┐  │
│                      │🖥️ │  │ ← Floating button
│                      │25 │  │    (shows log count)
│                      └───┘  │
└─────────────────────────────┘
```

---

## 📚 Full Documentation

For complete documentation, see [DEVELOPER_MODE_FEATURE.md](./DEVELOPER_MODE_FEATURE.md)

---

**Quick Reference Card**

```
┌──────────────────────────────────────────┐
│ DEVELOPER MODE QUICK REFERENCE           │
├──────────────────────────────────────────┤
│ Enable:  Tap bug icon 🐛                 │
│ Disable: Tap bug icon again              │
│ Minimize: Tap − button                   │
│ Expand: Tap floating button              │
│ Clear: Tap Clear button                  │
│ Copy: Tap Copy button                    │
│ Share: Tap Share button                  │
│ Scroll: Tap Bottom button                │
│ Auto-scroll: Tap lock icon               │
├──────────────────────────────────────────┤
│ Log Levels:                              │
│ 🔍 DEBUG   ℹ️ INFO   ⚠️ WARN            │
│ ❌ ERROR   🚨 CRITICAL                   │
├──────────────────────────────────────────┤
│ Contexts:                                │
│ [AUTH] [NAVIGATION] [GOOGLE-AUTH]        │
│ [STATE-CHANGE] [API]                     │
└──────────────────────────────────────────┘
```

---

**Last Updated**: 2025-10-30

