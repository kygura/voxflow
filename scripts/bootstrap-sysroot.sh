#!/usr/bin/env bash
# Rebuilds ~/.local/sysroot from scratch: downloads -dev packages (and their
# full dependency closure) with `apt-get download` (no root needed) and
# extracts them with `dpkg -x`. Re-run any time to refresh or repair the
# sysroot. Does not touch the real system (no `apt-get install`).
set -euo pipefail

SYSROOT="$HOME/.local/sysroot"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PKGS="libasound2-dev libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev \
libjavascriptcoregtk-4.1-dev libayatana-appindicator3-dev libxdo-dev \
libdbus-1-dev librsvg2-dev libssl-dev pkgconf libclang-dev"

mkdir -p "$SYSROOT"

echo "Resolving full dependency closure (already-installed packages are skipped)..."
apt-get install --no-install-recommends -y --print-uris $PKGS \
  | grep "^'http" | sed -E "s/^'([^']+)'.*/\1/" > "$WORK/urls.txt"
echo "$(wc -l < "$WORK/urls.txt") .deb files to fetch"

cd "$WORK"
xargs -a urls.txt -P 8 -n 1 wget -q --no-verbose

echo "Extracting into $SYSROOT ..."
for f in *.deb; do dpkg -x "$f" "$SYSROOT"; done

echo "Fixing dangling library symlinks (point them at the real system .so if present)..."
cd "$SYSROOT/usr/lib/x86_64-linux-gnu"
for f in $(find . -maxdepth 1 -xtype l); do
  base=$(basename "$(readlink "$f")")
  real="/usr/lib/x86_64-linux-gnu/$base"
  if [ -e "$real" ]; then
    ln -sf "$real" "$f"
  else
    found=$(find "$SYSROOT" -maxdepth 6 -name "$base" -not -path "*/x86_64-linux-gnu/$base" 2>/dev/null | head -1)
    [ -n "$found" ] && ln -sf "$found" "$f" || echo "  WARNING: could not resolve $f -> $base"
  fi
done
mkdir -p mit-krb5
for lib in libkrb5support.so libk5crypto.so libgssapi_krb5.so libkrb5.so; do
  [ -L "$lib" ] && [ -e "$lib" ] && cp -P "$lib" "mit-krb5/$lib"
done

# Ubuntu's libxdo-dev ships headers only, no .pc file (upstream xdotool has
# never shipped one). Synthesize it so `pkg-config xdo` works like the other
# libraries.
mkdir -p pkgconfig
cat > pkgconfig/xdo.pc <<'EOF'
prefix=/usr
libdir=${prefix}/lib/x86_64-linux-gnu
includedir=${prefix}/include

Name: libxdo
Description: X11 automation library (xdotool) - synthetic .pc, upstream ships none
Version: 3.20160805.1
Libs: -L${libdir} -lxdo
Cflags: -I${includedir}
EOF

echo "Installing cmake via uv (not from apt, per project convention)..."
uv tool install cmake >/dev/null

echo "Done. Sysroot at $SYSROOT ($(du -sh "$SYSROOT" | cut -f1))."
echo "Source scripts/linux-dev-env.sh before building."
