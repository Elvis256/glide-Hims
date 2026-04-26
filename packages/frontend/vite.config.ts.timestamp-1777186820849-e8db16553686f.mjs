// vite.config.ts
import { defineConfig } from "file:///root/glide-Hims/node_modules/.pnpm/vite@5.4.10_@types+node@24.10.9_lightningcss@1.30.2_terser@5.46.0/node_modules/vite/dist/node/index.js";
import react from "file:///root/glide-Hims/node_modules/.pnpm/@vitejs+plugin-react@4.3.3_vite@5.4.10_@types+node@24.10.9_lightningcss@1.30.2_terser@5.46.0_/node_modules/@vitejs/plugin-react/dist/index.mjs";
import tailwindcss from "file:///root/glide-Hims/node_modules/.pnpm/@tailwindcss+vite@4.1.18_vite@5.4.10_@types+node@24.10.9_lightningcss@1.30.2_terser@5.46.0_/node_modules/@tailwindcss/vite/dist/index.mjs";
import { readFileSync } from "fs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/root/glide-Hims/packages/frontend";
var certsDir = resolve(__vite_injected_original_dirname, "certs");
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Strip console.log/warn in production builds
    minify: "esbuild"
  },
  esbuild: {
    drop: ["console", "debugger"]
  },
  server: {
    port: 5173,
    host: true,
    // Allow network access
    https: {
      key: readFileSync(resolve(certsDir, "key.pem")),
      cert: readFileSync(resolve(certsDir, "cert.pem"))
    },
    proxy: {
      "/api": {
        target: "https://localhost:3000",
        changeOrigin: true,
        secure: false
      },
      "/socket.io": {
        target: "https://localhost:3000",
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  preview: {
    port: 5173,
    host: true,
    // Allow network access
    https: {
      key: readFileSync(resolve(certsDir, "key.pem")),
      cert: readFileSync(resolve(certsDir, "cert.pem"))
    },
    proxy: {
      "/api": {
        target: "https://localhost:3000",
        changeOrigin: true,
        secure: false
      },
      "/socket.io": {
        target: "https://localhost:3000",
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9nbGlkZS1IaW1zL3BhY2thZ2VzL2Zyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9nbGlkZS1IaW1zL3BhY2thZ2VzL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2dsaWRlLUhpbXMvcGFja2FnZXMvZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJ1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCdcblxuY29uc3QgY2VydHNEaXIgPSByZXNvbHZlKF9fZGlybmFtZSwgJ2NlcnRzJylcblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXG4gIGJ1aWxkOiB7XG4gICAgLy8gU3RyaXAgY29uc29sZS5sb2cvd2FybiBpbiBwcm9kdWN0aW9uIGJ1aWxkc1xuICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICB9LFxuICBlc2J1aWxkOiB7XG4gICAgZHJvcDogWydjb25zb2xlJywgJ2RlYnVnZ2VyJ10sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZSwgLy8gQWxsb3cgbmV0d29yayBhY2Nlc3NcbiAgICBodHRwczoge1xuICAgICAga2V5OiByZWFkRmlsZVN5bmMocmVzb2x2ZShjZXJ0c0RpciwgJ2tleS5wZW0nKSksXG4gICAgICBjZXJ0OiByZWFkRmlsZVN5bmMocmVzb2x2ZShjZXJ0c0RpciwgJ2NlcnQucGVtJykpLFxuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgICcvc29ja2V0LmlvJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcHJldmlldzoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZSwgLy8gQWxsb3cgbmV0d29yayBhY2Nlc3NcbiAgICBodHRwczoge1xuICAgICAga2V5OiByZWFkRmlsZVN5bmMocmVzb2x2ZShjZXJ0c0RpciwgJ2tleS5wZW0nKSksXG4gICAgICBjZXJ0OiByZWFkRmlsZVN5bmMocmVzb2x2ZShjZXJ0c0RpciwgJ2NlcnQucGVtJykpLFxuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgICcvc29ja2V0LmlvJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdSLFNBQVMsb0JBQW9CO0FBQ3JULE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUN4QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGVBQWU7QUFKeEIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTSxXQUFXLFFBQVEsa0NBQVcsT0FBTztBQUczQyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLEVBQ2hDLE9BQU87QUFBQTtBQUFBLElBRUwsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU0sQ0FBQyxXQUFXLFVBQVU7QUFBQSxFQUM5QjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxLQUFLLGFBQWEsUUFBUSxVQUFVLFNBQVMsQ0FBQztBQUFBLE1BQzlDLE1BQU0sYUFBYSxRQUFRLFVBQVUsVUFBVSxDQUFDO0FBQUEsSUFDbEQ7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDWixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsTUFDTjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLEtBQUssYUFBYSxRQUFRLFVBQVUsU0FBUyxDQUFDO0FBQUEsTUFDOUMsTUFBTSxhQUFhLFFBQVEsVUFBVSxVQUFVLENBQUM7QUFBQSxJQUNsRDtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNaLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxRQUNSLElBQUk7QUFBQSxNQUNOO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
