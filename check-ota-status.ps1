# ============================================
# Check OTA Update Status
# ============================================
# This script helps diagnose why OTA updates
# are not being received by your app
# ============================================

# Colors for output
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "============================================" -ForegroundColor Blue
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

# ============================================
# Check Configuration
# ============================================

Write-Header "Checking OTA Update Configuration"

$appJson = Get-Content "app.json" -Raw | ConvertFrom-Json

$appName = $appJson.expo.name
$appVersion = $appJson.expo.version
$runtimeVersion = $appJson.expo.runtimeVersion

Write-Info "App Name: $appName"
Write-Info "App Version: $appVersion"
Write-Info "Runtime Version (in app.json): $runtimeVersion"
Write-Host ""

# ============================================
# Check Latest Updates
# ============================================

Write-Header "Checking Latest OTA Updates"

Write-Info "Fetching latest updates on production branch..."
Write-Host ""

eas update:list --branch production --limit 3

Write-Host ""

# ============================================
# Check Channel Configuration
# ============================================

Write-Header "Checking Channel Configuration"

Write-Info "Fetching channel information..."
Write-Host ""

eas channel:view production

Write-Host ""

# ============================================
# Diagnosis
# ============================================

Write-Header "Diagnosis and Solution"

Write-Warning-Custom "Common reasons why OTA updates do not work:"
Write-Host ""
Write-Error-Custom "1. Runtime Version Mismatch (MOST COMMON)"
Write-Info "   - Your installed app has a different runtime version"
Write-Info "   - OTA updates only work when runtime versions match"
Write-Info "   - Solution: Build and install a new APK with runtime version $runtimeVersion"
Write-Host ""
Write-Error-Custom "2. Wrong Channel"
Write-Info "   - Your app is pointing to a different channel"
Write-Info "   - Solution: Make sure your build uses the correct channel"
Write-Host ""
Write-Error-Custom "3. Updates Not Enabled"
Write-Info "   - expo-updates might not be properly configured"
Write-Info "   - Solution: Check app.json for updates configuration"
Write-Host ""
Write-Error-Custom "4. App Not Checking for Updates"
Write-Info "   - App might not be checking for updates on launch"
Write-Info "   - Solution: Make sure checkAutomatically is set to ON_LOAD"
Write-Host ""

Write-Header "Recommended Solution"

Write-Success "To fix OTA updates:"
Write-Host ""
Write-Info "1. Build a new APK with the current runtime version:"
Write-Info "   eas build --platform android --profile production"
Write-Host ""
Write-Info "2. Download and install the new APK on your device"
Write-Host ""
Write-Info "3. Uninstall the old app first to avoid conflicts"
Write-Host ""
Write-Info "4. After installing, OTA updates will work automatically"
Write-Host ""
Write-Info "5. Future code changes can be published with:"
Write-Info "   bash publish-update.sh -m 'Your update message'"
Write-Host ""

Write-Header "Quick Reference"

Write-Info "Current Configuration:"
Write-Info "   App Version: $appVersion"
Write-Info "   Runtime Version: $runtimeVersion"
Write-Info "   Channel: production"
Write-Host ""
Write-Info "Useful Commands:"
Write-Info "   Check updates:  eas update:list --branch production"
Write-Info "   Check channels: eas channel:list"
Write-Info "   Check builds:   eas build:list --platform android --limit 5"
Write-Host ""

Write-Success "Diagnostic completed!"
Write-Host ""

