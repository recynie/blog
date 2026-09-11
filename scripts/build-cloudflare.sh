#!/usr/bin/env bash
# Cloudflare Pages v3: Linux x86_64, no root privileges required.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

QUARTO_VERSION=1.10.18
UV_VERSION=0.11.18
TOOLS_DIR="$(mktemp -d)"
trap 'rm -rf "$TOOLS_DIR"' EXIT

curl -fsSL --retry 3 --retry-all-errors --connect-timeout 30 \
  "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz" \
  -o "$TOOLS_DIR/quarto.tar.gz"
tar -xzf "$TOOLS_DIR/quarto.tar.gz" -C "$TOOLS_DIR"

curl -fsSL --retry 3 --retry-all-errors --connect-timeout 30 \
  "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz" \
  -o "$TOOLS_DIR/uv.tar.gz"
tar -xzf "$TOOLS_DIR/uv.tar.gz" -C "$TOOLS_DIR"
export PATH="$TOOLS_DIR/quarto-${QUARTO_VERSION}/bin:$TOOLS_DIR/uv-x86_64-unknown-linux-gnu:$PATH"
# Use the same Python minor version for rendering and verification.
export UV_PYTHON=3.12

quarto --version
uv --version
quarto render
uv run --no-project scripts/verify.py

uv run --no-project python - <<'PY'
from pathlib import Path

limit = 25 * 1024 * 1024
oversized = [p for p in Path('_site').rglob('*') if p.is_file() and p.stat().st_size > limit]
if oversized:
    raise SystemExit('Cloudflare Pages file limit exceeded (25 MiB):\n' + '\n'.join(map(str, oversized)))
print('PASS: all output files are within the Cloudflare Pages 25 MiB limit.')
PY
