module.exports = {
  apps: [
    {
      name: 'glide-hims-backend',
      script: 'dist/main.js',
      cwd: 'C:/hims/glide-Hims/packages/backend',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      autorestart: true,
      max_restarts: 10
    },
    {
      name: 'glide-hims-frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 5173 --host 0.0.0.0',
      cwd: 'C:/hims/glide-Hims/packages/frontend',
      watch: false,
      autorestart: true,
      max_restarts: 10
    }
  ]
};
