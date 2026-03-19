module.exports = {
  apps: [
    {
      name: 'glide-hims-backend',
      script: 'dist/main.js',
      cwd: '/home/bi/hims/glide-Hims/packages/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/glide-backend-error.log',
      out_file: '/var/log/pm2/glide-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
    {
      name: 'glide-hims-frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 5173 --host 0.0.0.0',
      cwd: '/home/bi/hims/glide-Hims/packages/frontend',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '256M',
      error_file: '/var/log/pm2/glide-frontend-error.log',
      out_file: '/var/log/pm2/glide-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    }
  ]
};
