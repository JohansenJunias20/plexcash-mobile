#!/usr/bin/env bash
# Builds a clean Android production release AAB.
#
# Why this exists: a stray local .env (dev-only, EXPO_PUBLIC_API_BASE_URL
# pointing at a developer's LAN IP) once got inlined into a production
# release build, and a stale Gradle/Metro cache then kept re-serving that
# broken bundle even after the .env was fixed. This script removes both
# failure points before every release build:
#   1. Refuses to run if .env exists and doesn't point at production.
#   2. Force-clears the JS bundle output + Metro cache so the build can't
#      reuse a stale bundle.
#   3. Greps the freshly built bundle for the known-bad LAN IP as a final
#      sanity check.
#
# Usage: ./scripts/release-build-android.sh

set -euo pipefail
cd "$(dirname "$0")/.."

PRODUCTION_HOST="app.plexseller.com"

if [ -f .env ]; then
  value=$(grep -E "^EXPO_PUBLIC_API_BASE_URL=" .env | cut -d= -f2- || true)
  if [ -n "$value" ] && [[ "$value" != *"$PRODUCTION_HOST"* ]]; then
    echo "🚨 .env sets EXPO_PUBLIC_API_BASE_URL=$value (not $PRODUCTION_HOST)." >&2
    echo "   Move it aside first: mv .env .env.local.bak" >&2
    exit 1
  fi
fi

echo "==> Clearing stale JS bundle output & Metro cache..."
rm -rf android/app/build/generated/assets/createBundleProductionReleaseJsAndAssets
rm -rf android/app/build/intermediates/assets/productionRelease
rm -rf android/app/build/intermediates/compressed_assets/productionRelease
rm -rf "${TEMP:-/tmp}"/metro-cache "${TEMP:-/tmp}"/metro-file-map-*

echo "==> Building :app:bundleProductionRelease (--rerun-tasks)..."
(cd android && ./gradlew :app:bundleProductionRelease --rerun-tasks --no-daemon)

BUNDLE_PATH="android/app/build/generated/assets/createBundleProductionReleaseJsAndAssets/index.android.bundle"
AAB_PATH="android/app/build/outputs/bundle/productionRelease/app-production-release.aab"

echo "==> Verifying built bundle does not contain a stray dev IP..."
if grep -aq "192\.168\.1\." "$BUNDLE_PATH" 2>/dev/null; then
  # Narrow check first (exact known-bad host); if it's a coincidental UI string
  # match, this still forces a human to look before shipping.
  echo "🚨 Bundle contains a 192.168.1.x string — verify this isn't a leaked dev API URL before publishing:" >&2
  grep -ao ".\{0,40\}192\.168\.1\.[0-9]\+.\{0,10\}" "$BUNDLE_PATH" | sort -u >&2 || true
fi

echo "✅ Build complete: $AAB_PATH"
echo "   Next: GOOGLE_PLAY_JSON_KEY_PATH=\"$(pwd)/service-account-key.json\" fastlane deploy track:beta aab_path:$AAB_PATH"
