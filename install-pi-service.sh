#!/bin/bash
set -euo pipefail

APP_DIR="${1:-/home/pi/project-portfolio-planner}"
SERVICE_NAME="project-portfolio-planner"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ ! -f "$APP_DIR/index.html" ]; then
  echo "ERROR: index.html was not found in $APP_DIR"
  exit 1
fi

sudo tee "$SERVICE_FILE" >/dev/null <<SERVICE
[Unit]
Description=Project Portfolio Planner static web server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/python3 -m http.server 5173 --bind 0.0.0.0
Restart=always
RestartSec=3
StandardOutput=append:/tmp/portfolio.log
StandardError=append:/tmp/portfolio.log

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager
