#!/usr/bin/env bash
# Build, sign and install the tradclip menu bar app.
#
#   macos/build.sh               build, sign, install into ~/Applications and launch
#   macos/build.sh --no-install  build only (output in macos/build/)
#
# Signs with the first Apple Development identity when one exists, so the
# Accessibility grant survives rebuilds; ad hoc otherwise.
# Needs: Rust, Xcode command line tools. No admin rights.
set -euo pipefail

INSTALL=1
case "${1:-}" in
  "") ;;
  --no-install) INSTALL=0 ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ARCH="$(uname -m)"
case "$ARCH" in
  arm64)  RUST_TARGET=aarch64-apple-darwin ;;
  x86_64) RUST_TARGET=x86_64-apple-darwin ;;
  *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

OUT="$ROOT/macos/build"
APP="$OUT/Tradclip.app"
LIBDIR="$OUT/rust/$RUST_TARGET/release"

export MACOSX_DEPLOYMENT_TARGET=13.0
echo "== Rust core ($RUST_TARGET)"
CARGO_TARGET_DIR="$OUT/rust" cargo build --release --target "$RUST_TARGET" -p tradclip-core

echo "== Swift shell"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp macos/Info.plist "$APP/Contents/Info.plist"
cp -R macos/Resources/. "$APP/Contents/Resources/"
swiftc -O -swift-version 5 \
  -module-name Tradclip \
  -target "${ARCH}-apple-macos13.0" \
  -import-objc-header macos/Bridging.h \
  -Xcc "-I$ROOT/crates/tradclip-core/include" \
  -L "$LIBDIR" -ltradclip_core \
  -framework Cocoa -framework Carbon -framework ServiceManagement \
  macos/Sources/*.swift \
  -o "$APP/Contents/MacOS/Tradclip"

SIGN_ID="$(security find-identity -v -p codesigning | sed -n 's/.*"\(Apple Development: [^"]*\)".*/\1/p' | head -1)"
if [ -n "$SIGN_ID" ]; then
  echo "== Sign ($SIGN_ID)"
  codesign --force --options runtime --sign "$SIGN_ID" "$APP"
else
  echo "== Sign (ad hoc; Accessibility must be granted again after each build)"
  codesign --force --sign - "$APP"
fi
codesign --verify --strict "$APP"

if [ "$INSTALL" = 0 ]; then
  echo "Built $APP"
  exit 0
fi

DEST="$HOME/Applications"
mkdir -p "$DEST"
killall Tradclip 2>/dev/null || true
rm -rf "$DEST/Tradclip.app"
cp -R "$APP" "$DEST/Tradclip.app"
open "$DEST/Tradclip.app"
echo "Installed and launched $DEST/Tradclip.app (繁 in the menu bar)."
