# ⚠️ Backend Integration Required

## Current Issue

When you click "Login with Google" in the mobile app, you're getting this error:

```
authentication failed json parse error; unexpected character: <
```

**Why?** The mobile app is trying to call backend OAuth endpoints that don't exist yet, so the backend returns an HTML 404 page instead of JSON.

---

## ✅ Quick Fix (5 Minutes)

### Step 1: Create the Controller File

The controller file should already exist at:
```
../Plex-Cash/Server/Controllers/MobileOAuthController.ts
```

If it doesn't exist, check the documentation files in `../Plex-Cash/` directory.

### Step 2: Register Routes in Backend

Open `../Plex-Cash/Server/index.ts` and add these lines:

**Find a good place** (around line 2331 where `/auth/login/token` is defined) and add:

```typescript
// Mobile OAuth endpoints
import MobileOAuthController from './Controllers/MobileOAuthController';

app.post("/auth/mobile/init", MobileOAuthController.initMobileAuth);
app.get("/auth/mobile/callback", MobileOAuthController.handleMobileCallback);
app.post("/auth/mobile/verify", MobileOAuthController.verifyMobileSession);
```

### Step 3: Add Environment Variable

Open `../Plex-Cash/Server/.env` and add:

```env
GOOGLE_WEB_CLIENT_SECRET=<get-from-google-cloud-console>
```

To get the client secret:
1. Go to https://console.cloud.google.com/
2. Select project: **plex-seller-id**
3. Go to: **APIs & Services** > **Credentials**
4. Find the **Web client** (Client ID: 227685404880-cdk3pq80i0d91si864gaakka214tg34l...)
5. Click on it and copy the **Client secret**

### Step 4: Configure Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Select: **plex-seller-id**
3. Go to: **APIs & Services** > **Credentials**
4. Edit **Web client** (227685404880-cdk3pq80i0d91si864gaakka214tg34l...)
5. Add to **Authorized JavaScript origins:**
   ```
   https://app.plexseller.com
   ```
6. Add to **Authorized redirect URIs:**
   ```
   https://app.plexseller.com/auth/mobile/callback
   ```
7. Click **Save**
8. **Wait 10 minutes** for changes to propagate

### Step 5: Restart Backend

```bash
cd ../Plex-Cash/Server
npm run dev
# or
npm start
```

### Step 6: Test Mobile App

1. Open this mobile app in Expo Go
2. Tap "Login with Google"
3. Should now work! ✅

---

## 📊 What Happens After Integration

Once the backend routes are registered, the flow will be:

1. **Mobile app** → `POST /auth/mobile/init` → Get sessionId
2. **Mobile app** → Opens browser for Google OAuth
3. **User** → Authenticates with Google
4. **Google** → Redirects to `https://app.plexseller.com/auth/mobile/callback`
5. **Backend** → Handles OAuth, redirects to `plexcash://redirect?session=xxx`
6. **Mobile app** → Receives deep link callback
7. **Mobile app** → `POST /auth/mobile/verify` → Get Firebase token
8. **Mobile app** → `POST /auth/login/token` → Login complete! ✅

---

## 🐛 Current Error Explained

**Error:**
```
authentication failed json parse error; unexpected character: <
```

**What's happening:**
1. Mobile app calls: `POST https://app.plexseller.com/auth/mobile/init`
2. Backend doesn't have this route registered
3. Backend returns HTML 404 page: `<!DOCTYPE html>...`
4. Mobile app tries to parse HTML as JSON
5. JSON parser sees `<` character and fails

**After fix:**
1. Mobile app calls: `POST https://app.plexseller.com/auth/mobile/init`
2. Backend route exists and returns: `{"sessionId": "...", "csrfToken": "..."}`
3. Mobile app successfully parses JSON ✅

---

## 📚 Complete Documentation

For detailed information, see:

1. **[MOBILE_OAUTH_README.md](./MOBILE_OAUTH_README.md)** - Quick reference
2. **[../Plex-Cash/MOBILE_OAUTH_FLOW_DIAGRAM.md](../Plex-Cash/MOBILE_OAUTH_FLOW_DIAGRAM.md)** - Visual flow
3. **[../Plex-Cash/Server/QUICK_START_MOBILE_OAUTH.md](../Plex-Cash/Server/QUICK_START_MOBILE_OAUTH.md)** - Backend integration
4. **[../Plex-Cash/GOOGLE_CLOUD_CONSOLE_SETUP.md](../Plex-Cash/GOOGLE_CLOUD_CONSOLE_SETUP.md)** - Google setup

---

## ✅ Checklist

- [ ] Create `MobileOAuthController.ts` (should already exist)
- [ ] Register 3 routes in `Server/index.ts`
- [ ] Add `GOOGLE_WEB_CLIENT_SECRET` to `.env`
- [ ] Configure Google Cloud Console (JavaScript origins + redirect URIs)
- [ ] Wait 10 minutes for Google changes to propagate
- [ ] Restart backend server
- [ ] Test mobile app

**Total time: ~15 minutes** (including 10 min wait for Google)

---

## 🆘 Need Help?

If you get stuck, check:
- Backend logs for errors
- Google Cloud Console configuration
- Environment variables in `.env`
- Routes are registered correctly in `index.ts`

The mobile app now shows helpful error messages if backend routes are missing!

