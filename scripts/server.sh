#!/bin/bash
# Glide-HIMS Server Management Script
# Usage: ./scripts/server.sh [start|stop|status|restart]

BACKEND_DIR="/home/elvis/glide-hims/packages/backend"
FRONTEND_DIR="/home/elvis/glide-hims/packages/frontend"
PNPM="$HOME/.local/share/pnpm/pnpm"

start_backend() {
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo "⚠️  Backend already running on port 3000"
    else
        echo "🚀 Starting backend..."
        cd "$BACKEND_DIR"
        setsid npm run dev > /tmp/glide-backend.log 2>&1 &
        sleep 8
        if lsof -ti:3000 > /dev/null 2>&1; then
            echo "✅ Backend started: http://localhost:3000"
        else
            echo "❌ Backend failed to start. Check /tmp/glide-backend.log"
        fi
    fi
}

start_frontend() {
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo "⚠️  Frontend already running on port 5173"
    else
        echo "🚀 Starting frontend..."
        cd "$FRONTEND_DIR"
        setsid "$PNPM" run dev --host > /tmp/glide-frontend.log 2>&1 &
        sleep 5
        if lsof -ti:5173 > /dev/null 2>&1; then
            echo "✅ Frontend started: http://localhost:5173"
        else
            echo "❌ Frontend failed to start. Check /tmp/glide-frontend.log"
        fi
    fi
}

stop_backend() {
    PID=$(lsof -ti:3000)
    if [ -n "$PID" ]; then
        kill $PID 2>/dev/null
        echo "🛑 Backend stopped (PID: $PID)"
    else
        echo "⚠️  Backend not running"
    fi
}

stop_frontend() {
    PID=$(lsof -ti:5173)
    if [ -n "$PID" ]; then
        kill $PID 2>/dev/null
        echo "🛑 Frontend stopped (PID: $PID)"
    else
        echo "⚠️  Frontend not running"
    fi
}

status() {
    echo "=== Glide-HIMS Server Status ==="
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo "✅ Backend:  http://localhost:3000 (PID: $(lsof -ti:3000))"
    else
        echo "❌ Backend:  Not running"
    fi
    
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo "✅ Frontend: http://localhost:5173 (PID: $(lsof -ti:5173))"
    else
        echo "❌ Frontend: Not running"
    fi
    echo ""
    echo "📍 Login: http://localhost:5173/login"
    echo "👤 Credentials: admin / Admin@123"
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
    *)
        echo "Glide-HIMS Server Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "  start   - Start backend and frontend servers"
        echo "  stop    - Stop all servers"
        echo "  restart - Restart all servers"
        echo "  status  - Show server status"
        ;;
esac
