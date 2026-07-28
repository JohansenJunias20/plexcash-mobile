#!/bin/bash

# ============================================
# Build Android APK (Local Build)
# ============================================
# Script untuk build Android APK (.apk)
# secara lokal untuk testing atau distribution
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_header() {
    echo ""
    print_message "$BLUE" "============================================"
    print_message "$BLUE" "$1"
    print_message "$BLUE" "============================================"
    echo ""
}

print_success() {
    print_message "$GREEN" "✅ $1"
}

print_error() {
    print_message "$RED" "❌ $1"
}

print_warning() {
    print_message "$YELLOW" "⚠️  $1"
}

print_info() {
    print_message "$BLUE" "ℹ️  $1"
}

# ============================================
# Configuration
# ============================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"

# Ask for build type
echo ""
print_info "Select build type:"
echo "1) Debug APK (for testing, no signing required)"
echo "2) Release APK (for production, requires keystore)"
read -p "$(echo -e ${YELLOW}Enter choice [1-2]: ${NC})" BUILD_CHOICE

if [ "$BUILD_CHOICE" = "2" ]; then
    BUILD_TYPE="release"
    FLAVOR="production"
    OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/apk/${FLAVOR}/release"
    APK_FILE="$OUTPUT_DIR/app-${FLAVOR}-release.apk"
    REQUIRES_SIGNING=true
    # Force production API URL for release build
    export EXPO_PUBLIC_API_BASE_URL="https://app.plexseller.com"
else
    BUILD_TYPE="debug"
    FLAVOR="production"
    OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/apk/${FLAVOR}/debug"
    APK_FILE="$OUTPUT_DIR/app-${FLAVOR}-debug.apk"
    REQUIRES_SIGNING=false
fi

# ============================================
# Check Prerequisites
# ============================================

print_header "Checking Prerequisites"

# Check if running on Windows (Git Bash/WSL)
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    print_info "Detected Windows environment (Git Bash)"
    IS_WINDOWS=true
else
    IS_WINDOWS=false
fi

# Check if Android directory exists
if [ ! -d "$ANDROID_DIR" ]; then
    print_error "Android directory not found at: $ANDROID_DIR"
    exit 1
fi
print_success "Android directory found"

# Check keystore for release builds
if [ "$REQUIRES_SIGNING" = true ]; then
    KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"
    if [ ! -f "$KEYSTORE_PROPS" ]; then
        print_error "keystore.properties not found at: $KEYSTORE_PROPS"
        print_info "Please create keystore.properties with production credentials"
        exit 1
    fi
    print_success "keystore.properties found"

    # Check if keystore file exists
    KEYSTORE_FILE=$(grep "PLEXCASH_UPLOAD_STORE_FILE" "$KEYSTORE_PROPS" | cut -d'=' -f2)
    KEYSTORE_PATH="$ANDROID_DIR/app/$KEYSTORE_FILE"
    if [ ! -f "$KEYSTORE_PATH" ]; then
        print_error "Keystore file not found at: $KEYSTORE_PATH"
        exit 1
    fi
    print_success "Keystore file found"
fi

# Check if gradlew exists
GRADLEW="$ANDROID_DIR/gradlew"
if [ ! -f "$GRADLEW" ]; then
    print_error "gradlew not found at: $GRADLEW"
    exit 1
fi
print_success "Gradle wrapper found"

# Make gradlew executable
chmod +x "$GRADLEW"

# ============================================
# Auto-Increment Version Code (Release only)
# ============================================

if [ "$REQUIRES_SIGNING" = true ]; then
    print_header "Auto-Increment Version Code"

    BUILD_GRADLE="$ANDROID_DIR/app/build.gradle"

    # Extract current versionCode
    CURRENT_VERSION_CODE=$(grep "versionCode" "$BUILD_GRADLE" | head -1 | awk '{print $2}')
    print_info "Current versionCode: $CURRENT_VERSION_CODE"

    # Increment versionCode
    NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
    print_info "New versionCode: $NEW_VERSION_CODE"

    # Update versionCode in build.gradle
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/versionCode $CURRENT_VERSION_CODE/versionCode $NEW_VERSION_CODE/" "$BUILD_GRADLE"
    else
        # Linux/Git Bash
        sed -i "s/versionCode $CURRENT_VERSION_CODE/versionCode $NEW_VERSION_CODE/" "$BUILD_GRADLE"
    fi

    print_success "Version code incremented: $CURRENT_VERSION_CODE → $NEW_VERSION_CODE"
else
    NEW_VERSION_CODE=$(grep "versionCode" "$ANDROID_DIR/app/build.gradle" | head -1 | awk '{print $2}')
fi

# ============================================
# Clean Previous Build
# ============================================

print_header "Cleaning Previous Build"

cd "$ANDROID_DIR"

# Stop Gradle daemon
print_info "Stopping Gradle daemon..."
./gradlew --stop || true

# Remove .cxx directory to avoid CMake errors
print_info "Removing .cxx directory..."
rm -rf "$ANDROID_DIR/app/.cxx" || true

# Clean build directory
print_info "Cleaning build directory..."
./gradlew clean || true

# Remove old APK file
if [ -f "$APK_FILE" ]; then
    print_info "Removing old APK file..."
    rm -f "$APK_FILE"
fi

print_success "Clean completed"

# ============================================
# Export JavaScript Bundle
# ============================================

print_header "Exporting JavaScript Bundle"

cd "$PROJECT_DIR"

print_info "Running npx expo export..."
print_warning "This will compile TypeScript and bundle JavaScript..."

# Export for production
if npx expo export --platform android --output-dir dist; then
    print_success "JavaScript bundle exported successfully!"
else
    print_error "Failed to export JavaScript bundle!"
    exit 1
fi

# Copy bundle to Android assets
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
print_info "Copying bundle to Android assets..."

# Create assets directory if it doesn't exist
mkdir -p "$ASSETS_DIR"

# Copy the exported bundle
if [ -d "dist" ]; then
    # Copy all files from dist to assets
    cp -r dist/* "$ASSETS_DIR/" || true
    print_success "Bundle copied to assets"
else
    print_warning "No dist directory found, using existing bundle"
fi

# ============================================
# Build APK
# ============================================

print_header "Building Android APK"

# Go back to Android directory
cd "$ANDROID_DIR"

print_info "Starting Gradle build for flavor: $FLAVOR ($BUILD_TYPE)"
print_warning "This may take 3-5 minutes..."

# Run Gradle build with flavor
if [ "$BUILD_TYPE" = "release" ]; then
    GRADLE_TASK="assemble${FLAVOR^}Release"
else
    GRADLE_TASK="assemble${FLAVOR^}Debug"
fi

print_info "Running: ./gradlew $GRADLE_TASK --no-daemon"

if ./gradlew "$GRADLE_TASK" --no-daemon; then
    print_success "Gradle build completed successfully!"
else
    print_error "Gradle build failed!"
    exit 1
fi

# ============================================
# Verify Output
# ============================================

print_header "Verifying Build Output"

if [ ! -f "$APK_FILE" ]; then
    print_error "APK file not found at: $APK_FILE"
    exit 1
fi

# Get file size
if [ "$IS_WINDOWS" = true ]; then
    # Windows (Git Bash) - use PowerShell to get file size
    FILE_SIZE=$(powershell.exe -Command "(Get-Item '$APK_FILE').Length")
else
    # Linux/Mac
    FILE_SIZE=$(stat -f%z "$APK_FILE" 2>/dev/null || stat -c%s "$APK_FILE" 2>/dev/null)
fi

# Convert to MB
FILE_SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $FILE_SIZE/1048576}")

print_success "APK file created successfully!"
echo ""
print_info "File: $APK_FILE"
print_info "Size: ${FILE_SIZE_MB} MB"

# Get file timestamp
if [ "$IS_WINDOWS" = true ]; then
    FILE_TIME=$(powershell.exe -Command "(Get-Item '$APK_FILE').LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')")
else
    FILE_TIME=$(date -r "$APK_FILE" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || stat -c %y "$APK_FILE" 2>/dev/null | cut -d'.' -f1)
fi
print_info "Created: $FILE_TIME"

# ============================================
# Extract Version Info
# ============================================

print_header "Build Information"

# Version info
print_info "Build Type: $BUILD_TYPE"
print_info "Version Code: $NEW_VERSION_CODE"
print_info "Version Name: $(grep "versionName" "$ANDROID_DIR/app/build.gradle" | head -1 | awk '{print $2}' | tr -d '"')"

# ============================================
# Summary
# ============================================

print_header "Build Summary"

print_success "Android APK built successfully!"
echo ""
print_info "📦 APK File Location:"
print_info "   $APK_FILE"
echo ""
print_info "📊 File Details:"
print_info "   Size: ${FILE_SIZE_MB} MB"
print_info "   Type: $BUILD_TYPE"
print_info "   Version: $(grep "versionName" "$ANDROID_DIR/app/build.gradle" | head -1 | awk '{print $2}' | tr -d '"') (Code: $NEW_VERSION_CODE)"
print_info "   Created: $FILE_TIME"
echo ""

if [ "$BUILD_TYPE" = "release" ]; then
    print_success "✅ Ready for distribution!"
    echo ""
    print_warning "Next Steps:"
    print_info "1. Test the APK on real devices"
    print_info "2. Distribute via email, website, or third-party stores"
    print_info "3. For Google Play Store, use build-aab.sh instead"
else
    print_success "✅ Ready for testing!"
    echo ""
    print_warning "Next Steps:"
    print_info "1. Install on device: adb install $APK_FILE"
    print_info "2. Or copy to device and install manually"
fi
echo ""

# ============================================
# Optional: Copy to Desktop
# ============================================

read -p "$(echo -e ${YELLOW}Do you want to copy APK to Desktop? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ "$IS_WINDOWS" = true ]; then
        DESKTOP="$USERPROFILE/Desktop"
    else
        DESKTOP="$HOME/Desktop"
    fi

    if [ -d "$DESKTOP" ]; then
        VERSION_NAME=$(grep "versionName" "$ANDROID_DIR/app/build.gradle" | head -1 | awk '{print $2}' | tr -d '"')
        DEST_FILE="$DESKTOP/plexcash-mobile-v${VERSION_NAME}-${NEW_VERSION_CODE}-${BUILD_TYPE}.apk"
        cp "$APK_FILE" "$DEST_FILE"
        print_success "APK copied to: $DEST_FILE"
    else
        print_warning "Desktop directory not found"
    fi
fi

echo ""
print_success "Build script completed! 🚀"
echo ""


