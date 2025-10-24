# Environment Configuration

## 🔧 Environment Variables Setup

The PlexCash mobile app uses environment variables for configuration. Follow these steps to set up your environment:

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Configure Your Environment

Edit the `.env` file with your specific configuration:

```env
# API Configuration
EXPO_PUBLIC_API_BASE_URL=http://your-backend-server.com

# Development Settings
EXPO_PUBLIC_SIMULATE_BACKEND=false

# App Configuration
EXPO_PUBLIC_APP_NAME=PlexCash
EXPO_PUBLIC_APP_VERSION=1.0.0

# Debug Settings
EXPO_PUBLIC_DEBUG_MODE=true
```

## 📋 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend server URL (without trailing slash) | `http://localhost:3000` |

### Optional Variables

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `EXPO_PUBLIC_SIMULATE_BACKEND` | Simulate backend responses for testing | `true` | `true`, `false` |
| `EXPO_PUBLIC_DEBUG_MODE` | Enable debug logging | `false` | `true`, `false` |
| `EXPO_PUBLIC_APP_NAME` | Application name | `PlexCash` | Any string |
| `EXPO_PUBLIC_APP_VERSION` | Application version | `1.0.0` | Semantic version |

## 🌍 Environment-Specific Configurations

### Development Environment

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_SIMULATE_BACKEND=true
EXPO_PUBLIC_DEBUG_MODE=true
```

### Staging Environment

```env
EXPO_PUBLIC_API_BASE_URL=https://staging-api.plexcash.com
EXPO_PUBLIC_SIMULATE_BACKEND=false
EXPO_PUBLIC_DEBUG_MODE=true
```

### Production Environment

```env
EXPO_PUBLIC_API_BASE_URL=https://api.plexcash.com
EXPO_PUBLIC_SIMULATE_BACKEND=false
EXPO_PUBLIC_DEBUG_MODE=false
```

## 🔒 Security Notes

1. **Never commit `.env` files** to version control
2. **Use different API URLs** for different environments
3. **Disable debug mode** in production
4. **Keep sensitive data** in environment variables, not in code

## 🚀 Usage in Code

The environment variables are automatically loaded and used in the API service:

```javascript
// services/api.js
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const SIMULATE_BACKEND = process.env.EXPO_PUBLIC_SIMULATE_BACKEND === 'true';
```

## 🛠️ Troubleshooting

### Environment Variables Not Loading

1. **Check file name**: Must be exactly `.env` (not `.env.txt`)
2. **Check location**: Must be in project root directory
3. **Restart Expo**: Run `npx expo start --clear` after changing variables
4. **Check syntax**: No spaces around `=` sign

### API Connection Issues

1. **Verify URL**: Check `EXPO_PUBLIC_API_BASE_URL` is correct
2. **Check network**: Ensure backend server is running
3. **Enable simulation**: Set `EXPO_PUBLIC_SIMULATE_BACKEND=true` for testing
4. **Check logs**: Enable `EXPO_PUBLIC_DEBUG_MODE=true` for detailed logs

## 📱 Platform-Specific Notes

### iOS
- Environment variables work in both Expo Go and standalone builds
- No additional configuration needed

### Android
- Environment variables work in both Expo Go and standalone builds
- No additional configuration needed

### Web
- All `EXPO_PUBLIC_*` variables are available in web builds
- Variables without `EXPO_PUBLIC_` prefix are not available in web builds
