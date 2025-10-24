# Google OAuth Setup untuk Plex Seller Mobile

## 🔧 OAuth Consent Screen Configuration

### 1. Basic Information
```
App name: Plex Seller Mobile
User support email: [YOUR_EMAIL]
App logo: [Optional - upload logo]
App domain: 
  - Application home page: https://plexseller.com (jika ada)
  - Application privacy policy link: https://plexseller.com/privacy (jika ada)
  - Application terms of service link: https://plexseller.com/terms (jika ada)
Developer contact information: [YOUR_EMAIL]
```

### 2. Scopes (Required)
Tambahkan scopes berikut:
```
../auth/userinfo.email
../auth/userinfo.profile  
openid
```

### 3. Test Users (Penting untuk Development)
Tambahkan email yang akan digunakan untuk testing:
```
[YOUR_EMAIL]
[OTHER_TEST_EMAILS]
```

### 4. Authorized Domains
```
expo.io
auth.expo.io
localhost
```

## 🔧 OAuth 2.0 Client Configuration

### Authorized Redirect URIs
```
https://auth.expo.io/@anonymous/plexcash-mobile
https://auth.expo.io/plexcash-mobile
http://localhost:19000
http://127.0.0.1:19000
```

## 🚀 Publishing Status

### Development (Current)
- Status: Testing
- Limitation: Hanya test users yang bisa login
- Solution: Tambahkan email sebagai test user

### Production (Future)
- Status: Published
- Limitation: Tidak ada
- Requirement: App verification oleh Google

## 🔍 Troubleshooting

### Error 400: invalid_request
1. Periksa redirect URI di credentials
2. Pastikan OAuth consent screen sudah dikonfigurasi
3. Tambahkan email sebagai test user

### Access blocked: authorisation error
1. Periksa authorized domains
2. Pastikan scopes sudah benar
3. Verify OAuth consent screen configuration

### App not verified
1. Tambahkan test users untuk development
2. Atau submit app untuk verification
