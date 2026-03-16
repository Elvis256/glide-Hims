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
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
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
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvcm9vdC9nbGlkZS1IaW1zL3BhY2thZ2VzL2Zyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvcm9vdC9nbGlkZS1IaW1zL3BhY2thZ2VzL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9yb290L2dsaWRlLUhpbXMvcGFja2FnZXMvZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJ1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCdcblxuY29uc3QgY2VydHNEaXIgPSByZXNvbHZlKF9fZGlybmFtZSwgJ2NlcnRzJylcblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZSwgLy8gQWxsb3cgbmV0d29yayBhY2Nlc3NcbiAgICBodHRwczoge1xuICAgICAga2V5OiByZWFkRmlsZVN5bmMocmVzb2x2ZShjZXJ0c0RpciwgJ2tleS5wZW0nKSksXG4gICAgICBjZXJ0OiByZWFkRmlsZVN5bmMocmVzb2x2ZShjZXJ0c0RpciwgJ2NlcnQucGVtJykpLFxuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgICAgJy9zb2NrZXQuaW8nOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgd3M6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHByZXZpZXc6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIGhvc3Q6IHRydWUsIC8vIEFsbG93IG5ldHdvcmsgYWNjZXNzXG4gICAgaHR0cHM6IHtcbiAgICAgIGtleTogcmVhZEZpbGVTeW5jKHJlc29sdmUoY2VydHNEaXIsICdrZXkucGVtJykpLFxuICAgICAgY2VydDogcmVhZEZpbGVTeW5jKHJlc29sdmUoY2VydHNEaXIsICdjZXJ0LnBlbScpKSxcbiAgICB9LFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICAgICcvc29ja2V0LmlvJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHdzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1IsU0FBUyxvQkFBb0I7QUFDclQsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBZTtBQUp4QixJQUFNLG1DQUFtQztBQU16QyxJQUFNLFdBQVcsUUFBUSxrQ0FBVyxPQUFPO0FBRzNDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsRUFDaEMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxLQUFLLGFBQWEsUUFBUSxVQUFVLFNBQVMsQ0FBQztBQUFBLE1BQzlDLE1BQU0sYUFBYSxRQUFRLFVBQVUsVUFBVSxDQUFDO0FBQUEsSUFDbEQ7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ1osUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsSUFBSTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxLQUFLLGFBQWEsUUFBUSxVQUFVLFNBQVMsQ0FBQztBQUFBLE1BQzlDLE1BQU0sYUFBYSxRQUFRLFVBQVUsVUFBVSxDQUFDO0FBQUEsSUFDbEQ7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ1osUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsSUFBSTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
