#!/bin/bash

# ============================================
# Build Production APK with OTA Updates
# ============================================
# This script builds a production APK that can
# receive OTA updates from the production channel
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
    print_message "$CYAN" "ℹ️  $1"
}

# ============================================
# Check Prerequisites
# ============================================

print_header "Checking Prerequisites"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_JSON="$PROJECT_DIR/app.json"

# Check if app.json exists
if [ ! -f "$APP_JSON" ]; then
    print_error "app.json not found at: $APP_JSON"
    exit 1
fi
print_success "app.json found"

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
    print_error "EAS CLI not found!"
    print_info "Install with: npm install -g eas-cli"
    exit 1
fi
print_success "EAS CLI found"

# Extract project info from app.json
APP_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
APP_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
RUNTIME_VERSION=$(grep -o '"runtimeVersion"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | tail -1 | sed 's/.*: *"\(.*\)".*/\1/')

print_info "App: $APP_NAME"
print_info "Version: $APP_VERSION"
print_info "Runtime Version: $RUNTIME_VERSION"

# ============================================
# Warning
# ============================================

print_header "Important Information"

print_warning "This will build a new APK with runtime version: $RUNTIME_VERSION"
print_warning "You MUST install this new APK to receive OTA updates!"
echo ""
print_info "After building:"
print_info "1. Download the APK from the EAS dashboard"
print_info "2. Uninstall the old app from your device"
print_info "3. Install the new APK"
print_info "4. Future OTA updates will work automatically"
echo ""

read -p "$(echo -e ${YELLOW}Do you want to continue? [y/N]: ${NC})" -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Build cancelled by user"
    exit 0
fi

# ============================================
# Check EAS Login
# ============================================

print_header "Checking EAS Authentication"

if ! eas whoami &> /dev/null; then
    print_warning "Not logged in to EAS"
    print_info "Please login to your Expo account..."
    echo ""
    
    if ! eas login; then
        print_error "Login failed!"
        exit 1
    fi
    
    print_success "Login successful!"
else
    EAS_USER=$(eas whoami 2>/dev/null)
    print_success "Logged in as: $EAS_USER"
fi

# ============================================
# Build APK
# ============================================

print_header "Building Production APK"

print_info "Profile: production"
print_info "Platform: Android"
print_info "Build Type: APK"
print_warning "This may take 10-20 minutes..."
echo ""

# Run eas build
if eas build --platform android --profile production; then
    print_success "Build started successfully!"
else
    print_error "Failed to start build!"
    exit 1
fi

# ============================================
# Summary
# ============================================

print_header "Build Summary"

print_success "Build started successfully! 🎉"
echo ""
print_info "📱 App: $APP_NAME v$APP_VERSION"
print_info "🔧 Runtime Version: $RUNTIME_VERSION"
print_info "📦 Build Type: APK"
echo ""
print_warning "⏳ Build is in progress..."
print_info "Monitor build progress:"
print_info "   eas build:list --platform android --limit 1"
echo ""
print_info "📥 After build completes:"
print_info "1. Download APK from EAS dashboard"
print_info "2. Uninstall old app from device"
print_info "3. Install new APK"
print_info "4. OTA updates will work automatically!"
echo ""

print_success "Build script completed! 🚀"
echo ""

