#!/usr/bin/env bash
# Build, sign and install the tradclip menu bar app.
#
#   macos/build.sh                      build, sign, install into /Applications and launch
#   macos/build.sh --no-install         build only (output in macos/build/)
#   macos/build.sh --sign "<identity>"  sign with that identity, hardened runtime and a
#                                       timestamp (used by macos/release.sh; no install)
#
# With rustup (~/.cargo/bin) the app is universal (Apple Silicon and Intel) and runs
# on macOS 13 or later. A Rust without rustup builds only this Mac's architecture,
# and its standard library may require this Mac's macOS version.
# Without --sign, signs with the first Apple Development identity when one exists,
# so the Accessibility grant survives rebuilds; ad hoc otherwise.
# Needs: Rust, Xcode command line tools. No admin rights.
set -euo pipefail

INSTALL=1
SIGN_ID=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-install) INSTALL=0 ;;
    --sign) SIGN_ID="${2:?--sign needs an identity}"; INSTALL=0; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -x "$HOME/.cargo/bin/rustup" ]; then
  CARGO="$HOME/.cargo/bin/cargo"
  ARCHS="arm64 x86_64"
  "$HOME/.cargo/bin/rustup" target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
else
  CARGO=cargo
  ARCHS="$(uname -m)"
  echo "note: no rustup; building $ARCHS only" >&2
fi

OUT="$ROOT/macos/build"
APP="$OUT/Tradclip.app"
export MACOSX_DEPLOYMENT_TARGET=13.0

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp macos/Info.plist "$APP/Contents/Info.plist"
cp -R macos/Resources/. "$APP/Contents/Resources/"

SLICES=()
for ARCH in $ARCHS; do
  case "$ARCH" in
    arm64)  RUST_TARGET=aarch64-apple-darwin ;;
    x86_64) RUST_TARGET=x86_64-apple-darwin ;;
    *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac
  echo "== Rust core ($RUST_TARGET)"
  CARGO_TARGET_DIR="$OUT/rust" "$CARGO" build --release --target "$RUST_TARGET" -p tradclip-core
  echo "== Swift shell ($ARCH)"
  swiftc -O -swift-version 5 \
    -module-name Tradclip \
    -target "${ARCH}-apple-macos13.0" \
    -import-objc-header macos/Bridging.h \
    -Xcc "-I$ROOT/crates/tradclip-core/include" \
    -L "$OUT/rust/$RUST_TARGET/release" -ltradclip_core \
    -framework Cocoa -framework Carbon -framework ServiceManagement \
    macos/Sources/*.swift \
    -o "$OUT/Tradclip-$ARCH"
  SLICES+=("$OUT/Tradclip-$ARCH")
done
lipo -create "${SLICES[@]}" -output "$APP/Contents/MacOS/Tradclip"
rm -f "${SLICES[@]}"
lipo -info "$APP/Contents/MacOS/Tradclip"

if [ -n "$SIGN_ID" ]; then
  echo "== Sign ($SIGN_ID, hardened runtime, timestamp)"
  codesign --force --options runtime --timestamp --sign "$SIGN_ID" "$APP"
  codesign --verify --strict "$APP"
  echo "Built $APP"
  exit 0
fi

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

DEST="/Applications"
mkdir -p "$DEST"
killall Tradclip 2>/dev/null || true
rm -rf "$DEST/Tradclip.app"
cp -R "$APP" "$DEST/Tradclip.app"
open "$DEST/Tradclip.app"
echo "Installed and launched $DEST/Tradclip.app (繁 in the menu bar)."
