import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("@monaco-editor") || id.includes("monaco-editor")) {
            return "vendor-monaco";
          }

          if (id.includes("@craftjs") || id.includes("re-resizable")) {
            return "vendor-builder";
          }

          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }

          if (id.includes("@dnd-kit")) {
            return "vendor-dnd";
          }

          if (id.includes("react-colorful") || id.includes("axios") || id.includes("lucide-react")) {
            return "vendor-ui";
          }

          return "vendor";
        },
      },
    },
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
