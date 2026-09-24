# ============================================
# Build Android AAB (Local Build) - PowerShell
# ============================================
# Script untuk build Android App Bundle (.aab)
# secara lokal dan opsional upload ke Google Play via Fastlane
# ============================================

param(
    [string]$ReleaseNotes = "",
    [string]$Track = "",
    [switch]$NoPrompt
)

# Stop on error
$ErrorActionPreference = "Stop"

# ============================================
# Functions
# ============================================

function Print-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "============================================" -ForegroundColor Blue
    Write-Host ""
}

function Print-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Print-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Print-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

# ============================================
# Configuration
# ============================================

$PROJECT_DIR = $PSScriptRoot
$ANDROID_DIR = Join-Path $PROJECT_DIR "android"

# Default flavor is production
$FLAVOR = "production"
$OUTPUT_DIR = Join-Path $ANDROID_DIR "app\build\outputs\bundle\${FLAVOR}Release"
$AAB_FILE = Join-Path $OUTPUT_DIR "app-${FLAVOR}-release.aab"

# Force production API URL during build to avoid private/local IP being bundled
$env:EXPO_PUBLIC_API_BASE_URL = "https://app.plexseller.com"

# Check .env if present
$ENV_FILE = Join-Path $PROJECT_DIR ".env"
if (Test-Path $ENV_FILE) {
    $envContent = Get-Content $ENV_FILE -Raw
    if ($envContent -match "EXPO_PUBLIC_API_BASE_URL\s*=\s*(\S+)") {
        $baseUrl = $Matches[1].Trim()
        if (-not ($baseUrl -like "*app.plexseller.com*")) {
            Print-Error ".env sets EXPO_PUBLIC_API_BASE_URL=$baseUrl (bukan app.plexseller.com)."
            exit 1
        }
    }
}

# ============================================
# Check Prerequisites
# ============================================

Print-Header "Checking Prerequisites"

# Check if Android directory exists
if (-not (Test-Path $ANDROID_DIR)) {
    Print-Error "Android directory not found at: $ANDROID_DIR"
    exit 1
}
Print-Success "Android directory found"

# Check if keystore.properties exists
$KEYSTORE_PROPS = Join-Path $ANDROID_DIR "keystore.properties"
if (-not (Test-Path $KEYSTORE_PROPS)) {
    Print-Error "keystore.properties not found at: $KEYSTORE_PROPS"
    Print-Info "Please create keystore.properties with production credentials"
    exit 1
}
Print-Success "keystore.properties found"

# Check if keystore file exists
$KEYSTORE_LINE = (Get-Content $KEYSTORE_PROPS | Select-String "PLEXCASH_UPLOAD_STORE_FILE").ToString().Trim()
$KEYSTORE_FILE = $KEYSTORE_LINE.Split('=')[1].Trim()
$KEYSTORE_PATH = Join-Path $ANDROID_DIR "app\$KEYSTORE_FILE"
if (-not (Test-Path $KEYSTORE_PATH)) {
    Print-Error "Keystore file not found at: $KEYSTORE_PATH"
    exit 1
}
Print-Success "Keystore file found"

# Check if gradlew exists
$GRADLEW = Join-Path $ANDROID_DIR "gradlew.bat"
if (-not (Test-Path $GRADLEW)) {
    Print-Error "gradlew.bat not found at: $GRADLEW"
    exit 1
}
Print-Success "Gradle wrapper found"

# ============================================
# Auto-Increment Version Code
# ============================================

Print-Header "Auto-Increment Version Code"

$BUILD_GRADLE = Join-Path $ANDROID_DIR "app\build.gradle"

# Extract current versionCode
$CURRENT_VERSION_CODE = (Get-Content $BUILD_GRADLE | Select-String "versionCode" | Select-Object -First 1).ToString().Trim().Split()[-1]
Print-Info "Current versionCode: $CURRENT_VERSION_CODE"

# Increment versionCode
$NEW_VERSION_CODE = [int]$CURRENT_VERSION_CODE + 1
Print-Info "New versionCode: $NEW_VERSION_CODE"

# Update versionCode in build.gradle
$BUILD_GRADLE_CONTENT = Get-Content $BUILD_GRADLE -Raw
$BUILD_GRADLE_CONTENT = $BUILD_GRADLE_CONTENT -replace "versionCode $CURRENT_VERSION_CODE", "versionCode $NEW_VERSION_CODE"
Set-Content $BUILD_GRADLE $BUILD_GRADLE_CONTENT -NoNewline

# Synchronize app.json versionCode
$APP_JSON = Join-Path $PROJECT_DIR "app.json"
if (Test-Path $APP_JSON) {
    $APP_JSON_CONTENT = Get-Content $APP_JSON -Raw
    $APP_JSON_CONTENT = $APP_JSON_CONTENT -replace '"versionCode":\s*\d+', "`"versionCode`": $NEW_VERSION_CODE"
    Set-Content $APP_JSON $APP_JSON_CONTENT -NoNewline
    Print-Success "app.json versionCode synchronized: $NEW_VERSION_CODE"
}

Print-Success "Version code incremented: $CURRENT_VERSION_CODE → $NEW_VERSION_CODE"

# ============================================
# Clean Previous Build & Caches
# ============================================

Print-Header "Cleaning Previous Build & Caches"

Push-Location $ANDROID_DIR

# Stop Gradle daemon
Print-Info "Stopping Gradle daemon..."
try {
    & .\gradlew.bat --stop | Out-Null
} catch {
    # Ignore errors
}

Pop-Location

# Remove stale JS bundle output & Metro cache
Print-Info "Clearing stale JS bundle outputs & Metro cache..."
Remove-Item -Recurse -Force (Join-Path $ANDROID_DIR "app\build\generated\assets\createBundleProductionReleaseJsAndAssets") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $ANDROID_DIR "app\build\intermediates\assets\productionRelease") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $ANDROID_DIR "app\build\intermediates\compressed_assets\productionRelease") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $ANDROID_DIR "app\.cxx") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:TEMP\metro-cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:TEMP\metro-file-map-*" -ErrorAction SilentlyContinue

# Remove old AAB file
if (Test-Path $AAB_FILE) {
    Print-Info "Removing old AAB file..."
    Remove-Item $AAB_FILE -Force
}

Print-Success "Clean completed"

# ============================================
# Export JavaScript Bundle
# ============================================

Print-Header "Exporting JavaScript Bundle"

Push-Location $PROJECT_DIR

Print-Info "Running npx expo export --platform android --output-dir dist..."
Print-Warning "This will compile TypeScript and bundle JavaScript..."

try {
    npx expo export --platform android --output-dir dist
    if ($LASTEXITCODE -ne 0) {
        throw "npx expo export failed with exit code $LASTEXITCODE"
    }
    Print-Success "JavaScript bundle exported successfully!"
} catch {
    Print-Error "Failed to export JavaScript bundle!"
    Print-Error $_.Exception.Message
    Pop-Location
    exit 1
}

# Copy bundle to Android assets
$ASSETS_DIR = Join-Path $ANDROID_DIR "app\src\main\assets"
Print-Info "Copying bundle to Android assets ($ASSETS_DIR)..."

if (-not (Test-Path $ASSETS_DIR)) {
    New-Item -ItemType Directory -Path $ASSETS_DIR -Force | Out-Null
}

if (Test-Path (Join-Path $PROJECT_DIR "dist")) {
    Copy-Item -Path (Join-Path $PROJECT_DIR "dist\*") -Destination $ASSETS_DIR -Recurse -Force
    Print-Success "Bundle copied to assets"
} else {
    Print-Warning "No dist directory found, using existing bundle"
}

Pop-Location

# ============================================
# Build AAB
# ============================================

Print-Header "Building Android App Bundle"

Push-Location $ANDROID_DIR

Print-Info "Starting Gradle build for flavor: $FLAVOR"
Print-Warning "This may take 3-5 minutes..."

# Run Gradle build with flavor
$GRADLE_TASK = "bundle$($FLAVOR.Substring(0,1).ToUpper())$($FLAVOR.Substring(1))Release"
Print-Info "Running: .\gradlew.bat $GRADLE_TASK --no-daemon"

try {
    & .\gradlew.bat $GRADLE_TASK --no-daemon
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle build failed with exit code $LASTEXITCODE"
    }
    Print-Success "Gradle build completed successfully!"
} catch {
    Print-Error "Gradle build failed!"
    Print-Error $_.Exception.Message
    Pop-Location
    exit 1
}

Pop-Location

# ============================================
# Verify Output
# ============================================

Print-Header "Verifying Build Output"

if (-not (Test-Path $AAB_FILE)) {
    Print-Error "AAB file not found at: $AAB_FILE"
    exit 1
}

# Get file info
$FileInfo = Get-Item $AAB_FILE
$FILE_SIZE = $FileInfo.Length
$FILE_SIZE_MB = [math]::Round($FILE_SIZE / 1MB, 2)
$FILE_TIME = $FileInfo.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")

Print-Success "AAB file created successfully!"
Write-Host ""
Print-Info "File: $AAB_FILE"
Print-Info "Size: $FILE_SIZE_MB MB"
Print-Info "Created: $FILE_TIME"

# ============================================
# Extract Version Info
# ============================================

Print-Header "Build Information"

$VERSION_NAME = (Get-Content $BUILD_GRADLE | Select-String "versionName" | Select-Object -First 1).ToString().Trim().Split('"')[1]

Print-Info "Version Code: $NEW_VERSION_CODE"
Print-Info "Version Name: $VERSION_NAME"

# ============================================
# Summary
# ============================================

Print-Header "Build Summary"

Print-Success "Android App Bundle built successfully!"
Write-Host ""
Print-Info "AAB File Location:"
Print-Info "   $AAB_FILE"
Write-Host ""
Print-Info "File Details:"
Print-Info "   Size: $FILE_SIZE_MB MB"
Print-Info "   Version: $VERSION_NAME (Code: $NEW_VERSION_CODE)"
Print-Info "   Created: $FILE_TIME"
Write-Host ""

# ============================================
# Auto-upload to Google Play (if Track is specified)
# ============================================

if ($Track) {
    Print-Header "Uploading to Google Play (track: $Track)"

    $JSON_KEY_PATH = Join-Path $PROJECT_DIR "service-account-key.json"
    if (-not (Test-Path $JSON_KEY_PATH)) {
        Print-Error "service-account-key.json not found at: $JSON_KEY_PATH"
        exit 1
    }

    $CHANGELOG_DIR = Join-Path $PROJECT_DIR "fastlane\metadata\android\id\changelogs"
    if (-not (Test-Path $CHANGELOG_DIR)) {
        New-Item -ItemType Directory -Path $CHANGELOG_DIR -Force | Out-Null
    }

    if ($ReleaseNotes) {
        $CHANGELOG_FILE = Join-Path $CHANGELOG_DIR "${NEW_VERSION_CODE}.txt"
        Set-Content -Path $CHANGELOG_FILE -Value $ReleaseNotes -Encoding UTF8
        Print-Success "Changelog written to: $CHANGELOG_FILE"
    }

    $env:GOOGLE_PLAY_JSON_KEY_PATH = $JSON_KEY_PATH
    $AAB_NORMALIZED_PATH = $AAB_FILE.Replace("\", "/")

    Print-Info "Running: fastlane android deploy track:$Track aab_path:`"$AAB_NORMALIZED_PATH`""
    try {
        fastlane android deploy "track:$Track" "aab_path:$AAB_NORMALIZED_PATH"
        if ($LASTEXITCODE -ne 0) {
            throw "Fastlane deploy failed with exit code $LASTEXITCODE"
        }
        Print-Success "Successfully uploaded and published to Google Play track '$Track'!"
    } catch {
        Print-Error "Fastlane upload failed!"
        Print-Error $_.Exception.Message
        exit 1
    }
} else {
    Print-Success "Ready to upload to Google Play Store!"
    Write-Host ""
    Print-Warning "Next Steps:"
    Print-Info "1. Go to Google Play Console"
    Print-Info "2. Select your app"
    Print-Info "3. Create new release in Production / Beta"
    Print-Info "4. Upload: $AAB_FILE"
    Print-Info "5. Fill release notes and submit"
    Write-Host ""
}

# ============================================
# Optional: Copy to Desktop
# ============================================

if (-not $NoPrompt) {
    $COPY_TO_DESKTOP = Read-Host "Do you want to copy AAB to Desktop? [y/N]"
    if ($COPY_TO_DESKTOP -eq "y" -or $COPY_TO_DESKTOP -eq "Y") {
        $DESKTOP = [Environment]::GetFolderPath("Desktop")
        
        if (Test-Path $DESKTOP) {
            $DEST_FILE = Join-Path $DESKTOP "plexcash-mobile-v$VERSION_NAME-$NEW_VERSION_CODE.aab"
            Copy-Item $AAB_FILE $DEST_FILE -Force
            Print-Success "AAB copied to: $DEST_FILE"
        } else {
            Print-Warning "Desktop directory not found"
        }
    }
}

Write-Host ""
Print-Success "Build script completed! 🚀"
Write-Host ""
