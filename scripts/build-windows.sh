#!/usr/bin/env bash
# Cross-compile the Windows exe from WSL/Linux with cargo-xwin (no Windows toolchain needed).
# Usage: scripts/build-windows.sh [destination-dir]   e.g. /mnt/c/Users/<you>/Desktop
set -euo pipefail
cd "$(dirname "$0")/.."

X="$HOME/.local/xtool"   # user-local LLVM 21, see README "Build Windows exe from WSL"
export PATH="$X/usr/lib/llvm-21/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
export LD_LIBRARY_PATH="$X/usr/lib/x86_64-linux-gnu:$X/usr/lib/llvm-21/lib:$HOME/.local/sysroot/usr/lib/llvm-21/lib"
export LIBCLANG_PATH="${LIBCLANG_PATH:-$HOME/.local/sysroot/usr/lib/llvm-21/lib}"
export CLANG_PATH="$X/usr/lib/llvm-21/bin/clang"

bun run build
cargo xwin build --release --target x86_64-pc-windows-msvc -p voxflow --features tauri/custom-protocol

exe=target/x86_64-pc-windows-msvc/release/voxflow.exe
if [[ $# -ge 1 ]]; then
  (cd /mnt/c && powershell.exe -NoProfile -Command "Stop-Process -Name VoxFlow -ErrorAction SilentlyContinue") || true
  cp "$exe" "$1/VoxFlow.exe"
  echo "copied to $1/VoxFlow.exe"
else
  echo "built $exe"
fi
