import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: [
      "@craftjs/core",
      "@craftjs/layers",
      "@monaco-editor/react",
      "@dnd-kit/core",
      "@dnd-kit/utilities",
      "react-colorful",
      "axios",
      "re-resizable"
    ],
  },
});
