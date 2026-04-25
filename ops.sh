#!/bin/bash

# Glide HIMS Operations Tool
# Usage: ./ops.sh [status|logs|backup|rotate-secrets]

case "$1" in
  status)
    echo "--- System Status ---"
    pm2 status
    ;;
  logs)
    echo "--- Viewing Backend Logs (Ctrl+C to stop) ---"
    pm2 logs hims-backend
    ;;
  backup)
    echo "--- Running Automated Backup ---"
    ./scripts/backup.sh
    ;;
  rotate-secrets)
    echo "--- Secret Rotation ---"
    echo "1. Generate new secrets using: openssl rand -base64 32"
    echo "2. Update .env file"
    echo "3. Run: pm2 restart hims-backend"
    ;;
  *)
    echo "Glide HIMS Operations Tool"
    echo "Available commands:"
    echo "  status         Check system health"
    echo "  logs           View backend logs"
    echo "  backup         Trigger manual backup"
    echo "  rotate-secrets Instructions for secret rotation"
    ;;
esac
