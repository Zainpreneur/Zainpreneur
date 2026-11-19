#!/usr/bin/env bash
# Install with the npm registry unreachable.
#
# Everything this project needs is in the local npm cache, but a few packages have
# a cached *tarball* without a cached *packument* (the registry metadata npm reads
# to resolve a version range). `npm install` therefore fails with ENOTCACHED on
# those, even though the bytes are sitting right there.
#
# The fix is to install them from their cached tarball via a `file:` dependency,
# which skips resolution entirely. This script does that automatically: run the
# install, read the package npm says is missing, vendor its tarball, wire up a
# `file:` dependency, and try again — until npm either succeeds or stops making
# progress.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VENDOR="$ROOT/vendor"
LOG="$ROOT/vendor/install.log"
MAX_ROUNDS=40
declare -A VENDORED=()

mkdir -p "$VENDOR"

slug() {  # "tailwindcss-vite" from "@tailwindcss/vite"
  echo "$1" | sed 's|@||; s|/|-|'
}

vendor() {  # vendor <pkg> [version]  -> echoes the file: spec, or empty on failure
  local pkg="$1" ver="${2:-}" hit path spec
  hit="$(python3 tools/find-cached-tarball.py "$pkg" "$ver" 2>/dev/null)" || return 1
  path="$(echo "$hit" | cut -f2)"
  spec="$(slug "$pkg")-$(echo "$hit" | cut -f1 | sed 's/.*@//').tgz"
  cp -n "$path" "$VENDOR/$spec" 2>/dev/null
  echo "file:vendor/$spec"
}

# add_dep <workspace-dir> <pkg> <spec>
add_dep() {
  local dir="$1" pkg="$2" spec="$3" tmp
  tmp="$(mktemp)"
  python3 - "$dir/package.json" "$pkg" "$spec" "$tmp" <<'PY'
import json, sys
path, pkg, spec, out = sys.argv[1:5]
d = json.load(open(path))
for field in ("dependencies", "devDependencies"):
    if pkg in d.get(field, {}):
        d[field][pkg] = spec
json.dump(d, open(out, "w"), indent=2)
open(out, "a").write("\n")
PY
  mv "$tmp" "$dir/package.json"
}

# add_override <pkg> <spec>
#
# Hoisting a `file:` dependency into a workspace is not enough: the package that
# actually *depends* on it still declares a registry range, and npm resolves that
# range itself. `overrides` rewrites the spec everywhere it appears, which is the
# only thing that actually redirects a transitive dependency offline.
add_override() {
  local pkg="$1" spec="$2" tmp
  tmp="$(mktemp)"
  python3 - "$pkg" "$spec" <<'PY' > "$tmp"
import json, sys
pkg, spec = sys.argv[1:3]
try:
    d = json.load(open("/root/zainpreneur/package.json"))
except ValueError:
    d = {}
d.setdefault("overrides", {})[pkg] = spec
json.dump(d, sys.stdout, indent=2)
print()
PY
  mv "$tmp" package.json
}

echo "==> installing (registry is unreachable; resolving from the local cache)"
for round in $(seq 1 "$MAX_ROUNDS"); do
  : > "$LOG"
  (setsid npm install --offline --no-audit --no-fund > "$LOG" 2>&1 &)
  for _ in $(seq 1 60); do
    grep -qE "added [0-9]+ package|^up to date|npm error" "$LOG" && break
    sleep 1
  done

  if grep -qE "added [0-9]+ package|^up to date" "$LOG"; then
    echo "==> converged after $round round(s)"
    tail -3 "$LOG"
    exit 0
  fi

  missing="$(grep -oE 'registry\.npmjs\.org/[^ ]+ failed' "$LOG" | head -1 \
    | sed 's| failed||; s|registry.npmjs.org/||' \
    | python3 -c 'import sys; from urllib.parse import unquote; print(unquote(sys.stdin.read().strip()))')"
  [ -z "$missing" ] && { echo "==> could not parse the missing package:"; tail -12 "$LOG"; exit 1; }

  # a packument failure names the package; a tarball failure only shows in the debug log
  if [ -z "${VENDORED[$missing]:-}" ]; then
    echo "==> [$round] vendoring $missing (packument not cached)"
    spec="$(vendor "$missing")" || {
      echo "    !! no cached tarball for $missing — cannot vendor it"; exit 1; }
    for ws in client server .; do
      grep -q "\"$missing\"" "$ws/package.json" 2>/dev/null && add_dep "$ws" "$missing" "$spec"
    done
    # Transitive packages appear in no manifest, so nothing recorded the `file:`
    # spec and the next round fails identically. Hoist them into the client
    # workspace — every package seen here (Tailwind's engine, Vite's plugin and
    # their native binaries) is client-side.
    if ! grep -rq "\"$missing\"" client/package.json server/package.json package.json 2>/dev/null; then
      add_dep client "$missing" "$spec"
    fi
    add_override "$missing" "file:./vendor/$(basename "${spec#file:}")"
    VENDORED[$missing]=1
  else
    echo "==> [$round] $missing still failing after vendoring; stopping"
    tail -12 "$LOG"
    exit 1
  fi
done

echo "==> gave up after $MAX_ROUNDS rounds"
tail -12 "$LOG"
exit 1