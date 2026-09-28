#!/usr/bin/env bash
# Download mihomo (the Clash core used by Clash Verge) for config validation tests.
# Usage: scripts/download-mihomo.sh [version...]   (default: v1.18.10 latest)
# Prints the downloaded binary paths, comma-separated, for MIHOMO_BIN.
set -euo pipefail

DEST="${MIHOMO_DIR:-.mihomo}"
mkdir -p "$DEST"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) echo "unsupported OS" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64) arch=amd64-compatible ;;
  *) echo "unsupported arch" >&2; exit 1 ;;
esac

versions=("$@")
if [ ${#versions[@]} -eq 0 ]; then
  latest="$(gh release view -R MetaCubeX/mihomo --json tagName -q .tagName)"
  # v1.18.10 approximates older cores bundled with Clash Verge
  versions=(v1.18.10 "$latest")
fi

paths=()
for v in "${versions[@]}"; do
  bin="$DEST/mihomo-$v"
  if [ ! -x "$bin" ]; then
    asset="mihomo-$os-$arch-$v.gz"
    gh release download "$v" -R MetaCubeX/mihomo -p "$asset" -O - | gunzip > "$bin"
    chmod +x "$bin"
  fi
  paths+=("$(cd "$(dirname "$bin")" && pwd)/$(basename "$bin")")
done

(IFS=,; echo "${paths[*]}")
