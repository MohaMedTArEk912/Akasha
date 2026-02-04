import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Vite options tailored for Tauri to prevent too much magic
  clearScreen: false,
  
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // By default, vite doesn't include the `node_modules`, but during
      // development `@tauri-apps/api` can be changed, and Vite shouldn't ignore it
      ignored: ["!**/node_modules/@tauri-apps/**"],
    },
  },

  build: {
    minify: !process.env.TAURI_DEBUG ? "terser" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
