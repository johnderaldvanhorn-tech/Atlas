#!/usr/bin/env bash

set -Eeuo pipefail

# Project Portfolio Planner release utility
#
# Usage:
#   ./release.sh 0.6.33
#
# Optional environment overrides:
#   PI_HOST=pi@jan3-server
#   PI_DIR=/home/pi/project-portfolio-planner
#   PORT=5173
#   PUBLIC_URL=https://project.theburrowfarm.com
#   GIT_REMOTE=origin

VERSION="${1:-}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PI_HOST="${PI_HOST:-pi@jan3-server}"
PI_DIR="${PI_DIR:-/home/pi/project-portfolio-planner}"
PORT="${PORT:-5173}"
PUBLIC_URL="${PUBLIC_URL:-https://project.theburrowfarm.com}"
GIT_REMOTE="${GIT_REMOTE:-origin}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./release.sh 0.6.33"
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9]+)*$ ]]; then
  echo "ERROR: Invalid version: $VERSION"
  echo "Expected a version such as 0.6.33"
  exit 1
fi

cd "$PROJECT_DIR"

if [[ ! -d ".git" ]]; then
  echo "ERROR: $PROJECT_DIR is not a Git repository."
  exit 1
fi

for required_file in index.html version.js app.js styles.css; do
  if [[ ! -f "$required_file" ]]; then
    echo "ERROR: Required file not found: $required_file"
    exit 1
  fi
done

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: Git is in detached HEAD state."
  exit 1
fi

echo "=================================================="
echo " Project Portfolio Planner Release v$VERSION"
echo "=================================================="
echo "Project:    $PROJECT_DIR"
echo "Branch:     $BRANCH"
echo "Git remote: $GIT_REMOTE"
echo "Pi target:  $PI_HOST:$PI_DIR"
echo "Port:       $PORT"
echo

# Update version.js, package.json, and cache-busting query strings.
python3 - "$VERSION" <<'PY'
from pathlib import Path
import json
import re
import sys

version = sys.argv[1]

version_file = Path("version.js")
text = version_file.read_text(encoding="utf-8")
updated, count = re.subn(
    r"const\s+APP_VERSION\s*=\s*['\"][^'\"]+['\"]\s*;",
    f"const APP_VERSION = '{version}';",
    text,
    count=1,
)
if count != 1:
    raise SystemExit("ERROR: Could not update APP_VERSION in version.js")
version_file.write_text(updated, encoding="utf-8")

package_file = Path("package.json")
if package_file.exists():
    data = json.loads(package_file.read_text(encoding="utf-8"))
    data["version"] = version
    package_file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

index_file = Path("index.html")
html = index_file.read_text(encoding="utf-8")

assets = [
    "styles.css",
    "version.js",
    "supabase-client.js",
    "app.js",
    "mobile.js",
]

for asset in assets:
    pattern = rf'({re.escape(asset)})(?:\?v=[^"\']*)?'
    html = re.sub(pattern, rf'\1?v={version}', html)

html = re.sub(
    r'(<span[^>]*data-app-version[^>]*>)v?[^<]*(</span>)',
    rf'\1v{version}\2',
    html,
)
html = re.sub(
    r'(<small[^>]*data-app-version[^>]*>)v?[^<]*(</small>)',
    rf'\1v{version}\2',
    html,
)

index_file.write_text(html, encoding="utf-8")
PY

echo "[1/7] Updated version and browser cache keys."

echo
echo "[2/7] Validating release references..."
grep -n "APP_VERSION" version.js
grep -nE "styles\.css\?v=|version\.js\?v=|app\.js\?v=|mobile\.js\?v=" index.html || true

if ! grep -q "styles.css?v=$VERSION" index.html; then
  echo "ERROR: styles.css cache key was not updated."
  exit 1
fi

if ! grep -q "app.js?v=$VERSION" index.html; then
  echo "ERROR: app.js cache key was not updated."
  exit 1
fi

if [[ -f mobile.js ]] && ! grep -q "mobile.js?v=$VERSION" index.html; then
  echo "ERROR: mobile.js cache key was not updated."
  exit 1
fi

echo
echo "[3/7] Committing release to GitHub..."
git add -A

if git diff --cached --quiet; then
  echo "No file changes detected."
else
  git commit -m "Release v$VERSION"
fi

git push "$GIT_REMOTE" "$BRANCH"

echo
echo "[4/7] Preparing remote directory..."
ssh "$PI_HOST" "mkdir -p '$PI_DIR'"

echo
echo "[5/7] Deploying the project folder to the Pi..."
rsync -avzc --delete \
  --exclude ".git" \
  --exclude ".github" \
  --exclude "node_modules" \
  --exclude ".DS_Store" \
  --exclude ".env" \
  --exclude ".env.local" \
  ./ \
  "$PI_HOST:$PI_DIR/"

echo
echo "[6/7] Restarting the Pi web server..."
ssh "$PI_HOST" bash <<EOF
set -Eeuo pipefail

sudo fuser -k ${PORT}/tcp 2>/dev/null || true
sleep 1

cd "$PI_DIR"

nohup python3 -m http.server "$PORT" \
  --bind 0.0.0.0 \
  > /tmp/project-portfolio-planner.log 2>&1 &

sleep 2

if ! curl -fsS "http://localhost:$PORT/version.js" | grep -q "$VERSION"; then
  echo "ERROR: Pi version verification failed."
  echo
  cat /tmp/project-portfolio-planner.log || true
  exit 1
fi

if ! curl -fsS "http://localhost:$PORT/index.html" | grep -q "styles.css?v=$VERSION"; then
  echo "ERROR: Pi CSS cache-key verification failed."
  exit 1
fi

echo "Pi is serving v$VERSION on port $PORT."
EOF

echo
echo "[7/7] Checking the public URL..."

CACHE_TOKEN="$(date +%s)"
PUBLIC_VERSION="$(curl -fsS "${PUBLIC_URL}/version.js?cache=${CACHE_TOKEN}" || true)"
PUBLIC_HTML="$(curl -fsS "${PUBLIC_URL}/index.html?cache=${CACHE_TOKEN}" || true)"

if grep -q "$VERSION" <<<"$PUBLIC_VERSION"; then
  echo "Public version check passed."
else
  echo "WARNING: Public version check did not return v$VERSION yet."
  echo "Cloudflare Tunnel or browser caching may need a few seconds."
fi

if grep -q "styles.css?v=$VERSION" <<<"$PUBLIC_HTML"; then
  echo "Public CSS cache-key check passed."
else
  echo "WARNING: Public HTML does not yet show styles.css?v=$VERSION."
fi

echo
echo "=================================================="
echo " Release v$VERSION complete"
echo "=================================================="
echo "Local project: $PROJECT_DIR"
echo "Public URL:    ${PUBLIC_URL}/?v=${VERSION}"
echo "Pi log:        ssh $PI_HOST 'tail -f /tmp/project-portfolio-planner.log'"
