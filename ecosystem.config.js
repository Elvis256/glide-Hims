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
      max_restarts: 10
    },
    {
      name: 'glide-hims-frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--port 5173 --host 0.0.0.0',
      cwd: '/home/bi/hims/glide-Hims/packages/frontend',
      watch: false,
      autorestart: true,
      max_restarts: 10
    }
  ]
};
