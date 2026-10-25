#!/usr/bin/env bash
# Build a signed, notarized, universal release of tradclip.
#
#   TRADCLIP_SIGN_ID="Developer ID Application: <name> (<team>)" \
#   TRADCLIP_NOTARY_PROFILE=<profile> \
#   macos/release.sh
#
# One-time setup, done by the maintainer (needs the Apple Developer account):
#   1. Xcode > Settings > Accounts > Manage Certificates > + > Developer ID Application
#   2. xcrun notarytool store-credentials <profile> --apple-id <id> --team-id <team>
#   3. rustup (https://rustup.rs) for the universal build and macOS 13 support
#
# Output: dist/tradclip-<version>-macos.zip, stapled, ready to publish.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${TRADCLIP_SIGN_ID:?set TRADCLIP_SIGN_ID to a Developer ID Application identity}"
: "${TRADCLIP_NOTARY_PROFILE:?set TRADCLIP_NOTARY_PROFILE to a notarytool keychain profile}"
case "$TRADCLIP_SIGN_ID" in
  "Developer ID Application:"*) ;;
  *) echo "notarization needs a Developer ID Application identity, not: $TRADCLIP_SIGN_ID" >&2; exit 2 ;;
esac
if [ ! -x "$HOME/.cargo/bin/rustup" ]; then
  echo "releases need rustup for the universal build" >&2; exit 2
fi

VERSION="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' macos/Info.plist)"
APP="macos/build/Tradclip.app"
ZIP="dist/tradclip-$VERSION-macos.zip"

bash macos/build.sh --sign "$TRADCLIP_SIGN_ID"

# Every slice must load on macOS 13 (no object built for a newer system).
for ARCH in arm64 x86_64; do
  MINOS="$(vtool -arch "$ARCH" -show-build "$APP/Contents/MacOS/Tradclip" | awk '/minos/ {print $2}')"
  echo "$ARCH minos $MINOS"
  [ "$MINOS" = "13.0" ] || { echo "unexpected minimum macOS for $ARCH: $MINOS" >&2; exit 1; }
done

mkdir -p dist
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "== Notarize"
xcrun notarytool submit "$ZIP" --keychain-profile "$TRADCLIP_NOTARY_PROFILE" --wait

echo "== Staple"
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"
spctl --assess --type execute --verbose "$APP"

shasum -a 256 "$ZIP"
echo "Release: $ZIP"
