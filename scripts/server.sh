#!/bin/bash
# Glide-HIMS Server Management Script
# Usage: ./scripts/server.sh [start|stop|status|restart|logs]
#
# Uses systemd user services for reliable auto-restart and persistence

start_backend() {
    echo "🚀 Starting backend..."
    systemctl --user start glide-backend.service
    sleep 8
    if systemctl --user is-active glide-backend.service > /dev/null 2>&1; then
        echo "✅ Backend started: http://localhost:3000"
    else
        echo "❌ Backend failed to start. Check: journalctl --user -u glide-backend.service"
    fi
}

start_frontend() {
    echo "🚀 Starting frontend..."
    systemctl --user start glide-frontend.service
    sleep 3
    if systemctl --user is-active glide-frontend.service > /dev/null 2>&1; then
        echo "✅ Frontend started: http://localhost:5173"
    else
        echo "❌ Frontend failed to start. Check: journalctl --user -u glide-frontend.service"
    fi
}

stop_backend() {
    systemctl --user stop glide-backend.service
    echo "🛑 Backend stopped"
}

stop_frontend() {
    systemctl --user stop glide-frontend.service
    echo "🛑 Frontend stopped"
}

status() {
    echo "=== Glide-HIMS Server Status ==="
    
    BACKEND_STATUS=$(systemctl --user is-active glide-backend.service 2>/dev/null)
    FRONTEND_STATUS=$(systemctl --user is-active glide-frontend.service 2>/dev/null)
    
    if [ "$BACKEND_STATUS" = "active" ]; then
        echo "✅ Backend:  http://localhost:3000 (systemd: active, auto-restart: enabled)"
    else
        echo "❌ Backend:  Not running (status: $BACKEND_STATUS)"
    fi
    
    if [ "$FRONTEND_STATUS" = "active" ]; then
        echo "✅ Frontend: http://localhost:5173 (systemd: active, auto-restart: enabled)"
    else
        echo "❌ Frontend: Not running (status: $FRONTEND_STATUS)"
    fi
    
    echo ""
    echo "📍 Login: http://localhost:5173/login"
    echo "👤 Credentials: admin / Admin@123"
    echo ""
    echo "ℹ️  Services auto-restart on crash and start on login"
}

logs() {
    echo "=== Backend Logs (last 50 lines) ==="
    journalctl --user -u glide-backend.service -n 50 --no-pager 2>/dev/null || tail -50 /tmp/glide-backend.log 2>/dev/null
    echo ""
    echo "=== Frontend Logs (last 30 lines) ==="
    journalctl --user -u glide-frontend.service -n 30 --no-pager 2>/dev/null || tail -30 /tmp/glide-frontend.log 2>/dev/null
}

case "$1" in
    start)
        start_backend
        start_frontend
        echo ""
        status
        ;;
    stop)
        stop_backend
        stop_frontend
        ;;
    restart)
        stop_backend
        stop_frontend
        sleep 2
        start_backend
        start_frontend
        echo ""
        status
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    *)
        echo "Glide-HIMS Server Management (systemd-powered)"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "  start   - Start backend and frontend servers"
        echo "  stop    - Stop all servers"
        echo "  restart - Restart all servers"
        echo "  status  - Show server status"
        echo "  logs    - Show recent logs"
        echo ""
        echo "⚡ Auto-restart: Services restart automatically on crash"
        echo "⚡ Auto-start:   Services start automatically on login"
        ;;
esac
