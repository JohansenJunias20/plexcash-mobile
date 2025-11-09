#!/bin/bash

# ============================================
# Publish OTA Update (EAS Update)
# ============================================
# Script untuk publish Over-The-Air update
# menggunakan EAS Update (tanpa upload ke Play Store)
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
# Configuration
# ============================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_JSON="$PROJECT_DIR/app.json"

# Default values
DEFAULT_BRANCH="production"
DEFAULT_MESSAGE=""

# ============================================
# Parse Arguments
# ============================================

BRANCH="$DEFAULT_BRANCH"
MESSAGE=""
AUTO_YES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--branch)
            BRANCH="$2"
            shift 2
            ;;
        -m|--message)
            MESSAGE="$2"
            shift 2
            ;;
        -y|--yes)
            AUTO_YES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -b, --branch BRANCH    Target branch (default: production)"
            echo "  -m, --message MESSAGE  Update message (required)"
            echo "  -y, --yes              Skip confirmation prompt"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -m \"Fix login bug\""
            echo "  $0 --branch staging --message \"Test new feature\""
            echo "  $0 -b production -m \"Update dashboard UI\" -y"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# ============================================
# Check Prerequisites
# ============================================

print_header "Checking Prerequisites"

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

# Check if expo-updates is configured
if ! grep -q "\"updates\"" "$APP_JSON"; then
    print_error "expo-updates not configured in app.json!"
    print_info "Please add updates configuration to app.json"
    exit 1
fi
print_success "expo-updates configured"

# Extract project info from app.json
APP_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
APP_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
PROJECT_ID=$(grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')

print_info "App: $APP_NAME"
print_info "Version: $APP_VERSION"
print_info "Project ID: $PROJECT_ID"

# ============================================
# Get Update Message
# ============================================

if [ -z "$MESSAGE" ]; then
    print_header "Update Information"
    echo ""
    print_warning "Update message is required!"
    print_info "This message is for internal tracking only (users won't see it)"
    echo ""
    print_info "Examples:"
    print_info "  - Fix login bug"
    print_info "  - Update dashboard UI"
    print_info "  - Add new payment method"
    print_info "  - Improve performance"
    echo ""
    read -p "$(echo -e ${CYAN}Enter update message: ${NC})" MESSAGE
    
    if [ -z "$MESSAGE" ]; then
        print_error "Update message cannot be empty!"
        exit 1
    fi
fi

# ============================================
# Confirmation
# ============================================

if [ "$AUTO_YES" = false ]; then
    print_header "Confirmation"
    echo ""
    print_info "App Name:       $APP_NAME"
    print_info "App Version:    $APP_VERSION"
    print_info "Target Branch:  $BRANCH"
    print_info "Update Message: $MESSAGE"
    echo ""
    print_warning "This will publish an OTA update to all users on branch '$BRANCH'"
    print_warning "Users will receive this update when they open the app"
    echo ""
    read -p "$(echo -e ${YELLOW}Do you want to continue? [y/N]: ${NC})" -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Update cancelled by user"
        exit 0
    fi
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
# Publish Update
# ============================================

print_header "Publishing OTA Update"

print_info "Branch: $BRANCH"
print_info "Message: $MESSAGE"
print_warning "This may take 1-3 minutes..."
echo ""

# Run eas update
if eas update --branch "$BRANCH" --message "$MESSAGE"; then
    print_success "Update published successfully!"
else
    print_error "Failed to publish update!"
    exit 1
fi

# ============================================
# Summary
# ============================================

print_header "Update Summary"

print_success "OTA Update published successfully! 🎉"
echo ""
print_info "📱 App: $APP_NAME v$APP_VERSION"
print_info "🌿 Branch: $BRANCH"
print_info "💬 Message: $MESSAGE"
echo ""
print_success "✅ Users will receive this update when they open the app!"
echo ""
print_info "📊 View update details:"
print_info "   https://expo.dev/accounts/$(eas whoami 2>/dev/null)/projects/$APP_NAME/updates"
echo ""
print_info "🔍 Check update status:"
print_info "   eas update:list --branch $BRANCH"
echo ""

# ============================================
# Optional: View Recent Updates
# ============================================

read -p "$(echo -e ${YELLOW}Do you want to view recent updates? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    print_header "Recent Updates on Branch: $BRANCH"
    eas update:list --branch "$BRANCH" --limit 5
fi

echo ""
print_success "Publish script completed! 🚀"
echo ""

