#!/bin/bash

set -e

VERSION=${1:-7.0.2}

PROJECT="$HOME/Projects/project-portfolio-planner"
DOWNLOADS="$HOME/Downloads"

echo "======================================"
echo "Project Portfolio Planner Release $VERSION"
echo "======================================"

cd "$PROJECT"

echo
echo "Looking for latest project ZIP..."

ZIP=$(find "$DOWNLOADS" -maxdepth 1 -type f \
  -name "project-portfolio-planner*.zip" \
  -print0 | xargs -0 ls -t | head -1)

if [ -z "$ZIP" ]; then
  echo "No project ZIP found in $DOWNLOADS"
  exit 1
fi

echo "Using:"
echo "$ZIP"

echo
echo "Creating temporary extraction folder..."

TEMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

echo
echo "Extracting ZIP..."

unzip -q "$ZIP" -d "$TEMP_DIR"

SOURCE_DIR="$TEMP_DIR"

TOP_LEVEL_DIRS=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
TOP_LEVEL_FILES=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type f | wc -l | tr -d ' ')

if [ "$TOP_LEVEL_DIRS" = "1" ] && [ "$TOP_LEVEL_FILES" = "0" ]; then
  SOURCE_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)
fi

echo
echo "Syncing release files into project..."

rsync -av --delete \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="release-from-downloads.sh" \
  "$SOURCE_DIR"/ "$PROJECT"/

echo
echo "Updating version references..."

if [ -f version.js ]; then
  perl -pi -e "s/(APP_VERSION\s*=\s*['\"])[^'\"]+(['\"])/\${1}$VERSION\${2}/g" version.js
fi

if [ -f index.html ]; then
  VERSION="$VERSION" python3 - <<'PYHTML'
import os, re
from pathlib import Path
p = Path("index.html")
s = p.read_text()
v = os.environ["VERSION"]
s = re.sub(r'(?<=["\'])((?:[^"\']+\.(?:css|js))\?v=)[0-9.]+', lambda m: m.group(1) + v, s)
s = re.sub(r'(<[^>]+data-app-version[^>]*>)v[0-9.]+(<)', lambda m: m.group(1) + "v" + v + m.group(2), s)
p.write_text(s)
PYHTML
fi

echo
echo "Verifying release metadata..."
grep -q "APP_VERSION=['\"]$VERSION['\"]" version.js
grep -q '"version": "'"$VERSION"'"' package.json
grep -q "# Project Portfolio Planner v$VERSION" README.md
grep -q "version.js?v=$VERSION" index.html
python3 -m json.tool package.json >/dev/null

echo
echo "Committing to Git..."

git add .

if git diff --cached --quiet; then
  echo "No Git changes to commit."
else
  git commit -m "Release $VERSION"
fi

git push

echo
echo "Deploying to Raspberry Pi..."

rsync -av --delete \
  --exclude=".git" \
  --exclude="node_modules" \
  ./ \
  pi@jan3-server:~/project-portfolio-planner/

echo
echo "Restarting web server on Pi..."

ssh pi@jan3-server '
  cd ~/project-portfolio-planner
  if systemctl list-unit-files project-portfolio-planner.service >/dev/null 2>&1; then
    sudo systemctl restart project-portfolio-planner
    sudo systemctl is-active --quiet project-portfolio-planner
  else
    pkill -f "python3 -m http.server 5173" || true
    nohup python3 -m http.server 5173 > ~/project-portfolio-planner/server.log 2>&1 &
  fi
  curl -fsSI http://localhost:5173/ >/dev/null
'

echo
echo "======================================"
echo "Release Complete"
echo "Version: $VERSION"
echo "======================================"
