#!/bin/bash

# ============================================
# Build Android AAB (Local Build)
# ============================================
# Script untuk build Android App Bundle (.aab)
# secara lokal tanpa menggunakan EAS Build
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
OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/bundle/release"
AAB_FILE="$OUTPUT_DIR/app-release.aab"

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

# Check if keystore.properties exists
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
# Clean Previous Build
# ============================================

print_header "Cleaning Previous Build"

cd "$ANDROID_DIR"

# Stop Gradle daemon
print_info "Stopping Gradle daemon..."
./gradlew --stop || true

# Remove old AAB file
if [ -f "$AAB_FILE" ]; then
    print_info "Removing old AAB file..."
    rm -f "$AAB_FILE"
fi

print_success "Clean completed"

# ============================================
# Build AAB
# ============================================

print_header "Building Android App Bundle"

print_info "Starting Gradle build..."
print_warning "This may take 3-5 minutes..."

# Run Gradle build
if ./gradlew bundleRelease --no-daemon; then
    print_success "Gradle build completed successfully!"
else
    print_error "Gradle build failed!"
    exit 1
fi

# ============================================
# Verify Output
# ============================================

print_header "Verifying Build Output"

if [ ! -f "$AAB_FILE" ]; then
    print_error "AAB file not found at: $AAB_FILE"
    exit 1
fi

# Get file size
if [ "$IS_WINDOWS" = true ]; then
    # Windows (Git Bash) - use PowerShell to get file size
    FILE_SIZE=$(powershell.exe -Command "(Get-Item '$AAB_FILE').Length")
else
    # Linux/Mac
    FILE_SIZE=$(stat -f%z "$AAB_FILE" 2>/dev/null || stat -c%s "$AAB_FILE" 2>/dev/null)
fi

# Convert to MB
FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1048576" | bc)

print_success "AAB file created successfully!"
echo ""
print_info "File: $AAB_FILE"
print_info "Size: ${FILE_SIZE_MB} MB"

# Get file timestamp
if [ "$IS_WINDOWS" = true ]; then
    FILE_TIME=$(powershell.exe -Command "(Get-Item '$AAB_FILE').LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')")
else
    FILE_TIME=$(date -r "$AAB_FILE" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || stat -c %y "$AAB_FILE" 2>/dev/null | cut -d'.' -f1)
fi
print_info "Created: $FILE_TIME"

# ============================================
# Extract Version Info
# ============================================

print_header "Build Information"

# Extract version from build.gradle
VERSION_CODE=$(grep "versionCode" "$ANDROID_DIR/app/build.gradle" | head -1 | awk '{print $2}')
VERSION_NAME=$(grep "versionName" "$ANDROID_DIR/app/build.gradle" | head -1 | awk '{print $2}' | tr -d '"')

print_info "Version Code: $VERSION_CODE"
print_info "Version Name: $VERSION_NAME"

# ============================================
# Summary
# ============================================

print_header "Build Summary"

print_success "Android App Bundle built successfully!"
echo ""
print_info "📦 AAB File Location:"
print_info "   $AAB_FILE"
echo ""
print_info "📊 File Details:"
print_info "   Size: ${FILE_SIZE_MB} MB"
print_info "   Version: $VERSION_NAME (Code: $VERSION_CODE)"
print_info "   Created: $FILE_TIME"
echo ""
print_success "✅ Ready to upload to Google Play Store!"
echo ""
print_warning "Next Steps:"
print_info "1. Go to Google Play Console"
print_info "2. Select your app"
print_info "3. Create new release in Production"
print_info "4. Upload: $AAB_FILE"
print_info "5. Fill release notes and submit"
echo ""

# ============================================
# Optional: Copy to Desktop
# ============================================

read -p "$(echo -e ${YELLOW}Do you want to copy AAB to Desktop? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ "$IS_WINDOWS" = true ]; then
        DESKTOP="$USERPROFILE/Desktop"
    else
        DESKTOP="$HOME/Desktop"
    fi
    
    if [ -d "$DESKTOP" ]; then
        DEST_FILE="$DESKTOP/plexcash-mobile-v${VERSION_NAME}-${VERSION_CODE}.aab"
        cp "$AAB_FILE" "$DEST_FILE"
        print_success "AAB copied to: $DEST_FILE"
    else
        print_warning "Desktop directory not found"
    fi
fi

echo ""
print_success "Build script completed! 🚀"
echo ""

