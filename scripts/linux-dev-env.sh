# Dev-only helper for building on a Linux box without root (WSL). Not needed
# on Windows or when system -dev packages are installed.
#
# Source this before cargo check/build/test:
#   source scripts/linux-dev-env.sh
#
# What it does: points pkg-config, the C/C++ toolchain, and the linker/loader
# at a user-local "sysroot" (extracted -dev .deb packages, see
# bootstrap-sysroot.sh) instead of the real /usr, since we have no sudo to
# install packages there. System-installed runtime .so files (already present
# under real /usr/lib) are still used for linking/loading — only headers and
# .pc files that are otherwise missing (-dev packages) come from the sysroot.

SYSROOT="$HOME/.local/sysroot"
SYS_LIBDIR="$SYSROOT/usr/lib/x86_64-linux-gnu"

export PATH="$SYSROOT/usr/bin:$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

export PKG_CONFIG_SYSROOT_DIR="$SYSROOT"
export PKG_CONFIG_LIBDIR="$SYS_LIBDIR/pkgconfig:$SYSROOT/usr/share/pkgconfig:$SYSROOT/usr/lib/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig:/usr/lib/pkgconfig"
unset PKG_CONFIG_PATH

# bindgen (whisper-rs-sys) needs a real libclang.so it can dlopen.
export LIBCLANG_PATH="$SYSROOT/usr/lib/llvm-21/lib"

# Headers for #include (webkit/gtk/soup/etc only exist under the sysroot).
export C_INCLUDE_PATH="$SYSROOT/usr/include"
export CPLUS_INCLUDE_PATH="$SYSROOT/usr/include"

# Link-time library search (sysroot .so symlinks, many pointing at real
# system runtime libs) and runtime loader path (libclang's own deps, e.g.
# libLLVM*, resolve from the real system libdir already).
export LIBRARY_PATH="$SYS_LIBDIR"
export LD_LIBRARY_PATH="$SYS_LIBDIR:$LIBCLANG_PATH${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# cmake comes from `uv tool install cmake` -> ~/.local/bin, already on PATH.
