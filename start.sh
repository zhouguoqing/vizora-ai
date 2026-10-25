#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.12+ is required. Install it, then retry." >&2
  exit 1
fi
exec node scripts/start.mjs "$@"
