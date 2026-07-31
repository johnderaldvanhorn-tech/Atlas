#!/bin/bash
set -euo pipefail

PROJECT_DIR="${1:-$HOME/Projects/project-portfolio-planner}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Project Portfolio Planner v7.0.2"
echo "Source:  $SOURCE_DIR"
echo "Target:  $PROJECT_DIR"

mkdir -p "$PROJECT_DIR"
if [ -d "$PROJECT_DIR/.git" ]; then
  mkdir -p "$PROJECT_DIR/backups"
  git -C "$PROJECT_DIR" status --short > "$PROJECT_DIR/backups/pre-7.0.2-status.txt" || true
fi

rsync -av --delete \
  --exclude '.git/' \
  --exclude 'backups/' \
  --exclude 'node_modules/' \
  --exclude 'deploy.sh' \
  --exclude 'release.sh' \
  "$SOURCE_DIR/" "$PROJECT_DIR/"

echo
echo "Installed v7.0.2."
echo "Next: run supabase/schema.sql in Supabase SQL Editor if project_sales_marketing is missing."
echo "Then deploy with: cd \"$PROJECT_DIR\" && ./release.sh 7.0.2"
