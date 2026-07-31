#!/bin/bash

set -e

REMOTE="pi@jan3-server"
REMOTE_DIR="~/project-portfolio-planner"

echo "========================================="
echo " Project Portfolio Planner Deployment"
echo "========================================="

echo ""
echo "1. Git Status"
git status

echo ""
echo "2. Committing changes (if any)..."

git add .

if ! git diff --cached --quiet; then
    read -p "Commit message: " MSG
    git commit -m "$MSG"
else
    echo "Nothing to commit."
fi

echo ""
echo "3. Pushing to GitHub..."
BRANCH=$(git branch --show-current)
git push origin "$BRANCH"

echo ""
echo "4. Deploying to Raspberry Pi..."

rsync -avz \
    --delete \
    --exclude ".git" \
    --exclude ".github" \
    --exclude "node_modules" \
    --exclude ".DS_Store" \
    ./ \
    ${REMOTE}:${REMOTE_DIR}/

echo ""
echo "5. Restarting Web Server..."

ssh ${REMOTE} <<'EOF'
cd ~/project-portfolio-planner
if systemctl list-unit-files project-portfolio-planner.service >/dev/null 2>&1; then
  sudo systemctl restart project-portfolio-planner
  sudo systemctl is-active --quiet project-portfolio-planner
else
  pkill -f "python3 -m http.server 5173" || true
  nohup python3 -m http.server 5173 >/tmp/portfolio.log 2>&1 &
fi
curl -fsSI http://localhost:5173/ >/dev/null
EOF

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Local:"
echo "http://localhost:5173"
echo ""
echo "Remote:"
echo "http://project.theburrowfarm.com"
