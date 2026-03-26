#!/bin/bash

# ============================================
# Check OTA Update Status
# ============================================
# This script helps diagnose why OTA updates
# are not being received by your app
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
# Check Configuration
# ============================================

print_header "Checking OTA Update Configuration"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_JSON="$PROJECT_DIR/app.json"

# Extract project info from app.json
APP_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
APP_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
RUNTIME_VERSION=$(grep -o '"runtimeVersion"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | tail -1 | sed 's/.*: *"\(.*\)".*/\1/')

print_info "App Name: $APP_NAME"
print_info "App Version: $APP_VERSION"
print_info "Runtime Version (in app.json): $RUNTIME_VERSION"
echo ""

# ============================================
# Check Latest Updates
# ============================================

print_header "Checking Latest OTA Updates"

print_info "Fetching latest updates on production branch..."
echo ""

eas update:list --branch production --limit 3

echo ""

# ============================================
# Check Channel Configuration
# ============================================

print_header "Checking Channel Configuration"

print_info "Fetching channel information..."
echo ""

eas channel:view production

echo ""

# ============================================
# Diagnosis
# ============================================

print_header "Diagnosis & Solution"

print_warning "Common reasons why OTA updates don't work:"
echo ""
print_error "1. Runtime Version Mismatch (MOST COMMON)"
print_info "   - Your installed app has a different runtime version"
print_info "   - OTA updates only work when runtime versions match"
print_info "   - Solution: Build and install a new APK with runtime version $RUNTIME_VERSION"
echo ""
print_error "2. Wrong Channel"
print_info "   - Your app is pointing to a different channel (e.g., 'preview' instead of 'production')"
print_info "   - Solution: Make sure your build uses the correct channel"
echo ""
print_error "3. Updates Not Enabled"
print_info "   - expo-updates might not be properly configured"
print_info "   - Solution: Check app.json for 'updates' configuration"
echo ""
print_error "4. App Not Checking for Updates"
print_info "   - App might not be checking for updates on launch"
print_info "   - Solution: Make sure checkAutomatically is set to 'ON_LOAD'"
echo ""

print_header "Recommended Solution"

print_success "To fix OTA updates:"
echo ""
print_info "1. Build a new APK with the current runtime version:"
print_info "   ./build-production.sh"
echo ""
print_info "2. Download and install the new APK on your device"
echo ""
print_info "3. Uninstall the old app first to avoid conflicts"
echo ""
print_info "4. After installing, OTA updates will work automatically"
echo ""
print_info "5. Future code changes can be published with:"
print_info "   ./publish-update.sh -m \"Your update message\""
echo ""

print_header "Quick Reference"

print_info "📱 Current Configuration:"
print_info "   App Version: $APP_VERSION"
print_info "   Runtime Version: $RUNTIME_VERSION"
print_info "   Channel: production"
echo ""
print_info "🔧 Useful Commands:"
print_info "   Check updates:  eas update:list --branch production"
print_info "   Check channels: eas channel:list"
print_info "   Check builds:   eas build:list --platform android --limit 5"
echo ""

print_success "Diagnostic completed! 🚀"
echo ""

