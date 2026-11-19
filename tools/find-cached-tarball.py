#!/usr/bin/env python3
"""Locate a package tarball inside the local npm cache.

The npm registry is unreachable from this machine, so some packages have a cached
tarball but no cached *packument* (the registry metadata npm needs to resolve a
version range). `npm install ./path/to/pkg.tgz` skips resolution entirely, so
those are installed from their cached tarball via a `file:` dependency instead.

Usage:  tools/find-cached-tarball.py <package-name> [version]
Prints the absolute path to the cached tarball, or exits 1 if absent.
"""
import hashlib
import json
import os
import re
import sys
from urllib.parse import unquote

CACHE = "/root/.npm/_cacache"
INDEX = os.path.join(CACHE, "index-v5")


def content_path(integrity: str) -> str:
    """Map a sha512-<base64> integrity string to its blob in content-v2."""
    algo, _, b64 = integrity.partition("-")
    hexd = __import__("base64").b64decode(b64).hex()
    return os.path.join(CACHE, "content-v2", algo, hexd[:2], hexd[2:4], hexd[4:])


def find(name: str, version: str | None):
    want_tar = f"registry.npmjs.org/{name}/-/".replace("@", "@")
    best = None
    for root, _, files in os.walk(INDEX):
        for f in files:
            p = os.path.join(root, f)
            try:
                raw = open(p, encoding="utf8", errors="ignore").read()
            except OSError:
                continue
            for line in raw.splitlines():
                if not line.strip():
                    continue
                _, _, payload = line.partition("\t")
                if not payload:
                    continue
                try:
                    entry = json.loads(payload)
                except ValueError:
                    continue
                key = entry.get("key", "")
                if want_tar not in key or not key.endswith(".tgz"):
                    continue
                url = unquote(key)
                tail = url.rsplit("/-/", 1)[1][:-4]  # strip /-/ and .tgz
                # tail looks like "tailwindcss-4.3.3" — recover the version
                short = name.split("/")[-1]
                m = re.match(re.escape(short) + r"-(.+)$", tail)
                if not m:
                    continue
                v = m.group(1)
                if version and v != version:
                    continue
                integ = (entry.get("integrity") or "").strip()
                if not integ:
                    continue
                blob = content_path(integ)
                if not os.path.exists(blob):
                    continue
                cand = (v, blob)
                if best is None or v > best[0]:
                    best = cand
    return best


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    name = sys.argv[1]
    version = sys.argv[2] if len(sys.argv) > 2 else None
    hit = find(name, version)
    if not hit:
        print(f"NOT CACHED: {name}" + (f"@{version}" if version else ""), file=sys.stderr)
        sys.exit(1)
    v, blob = hit
    print(f"{name}@{v}\t{blob}")