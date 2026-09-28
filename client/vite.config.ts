import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // Excalidraw canvas is massive (~4MB) - isolate in dedicated chunk
          if (id.includes("@excalidraw")) {
            return "vendor-excalidraw";
          }

          // Monaco code editor
          if (id.includes("@monaco-editor") || id.includes("monaco-editor")) {
            return "vendor-monaco";
          }

          // Craft.js visual canvas builder
          if (id.includes("@craftjs") || id.includes("re-resizable")) {
            return "vendor-builder";
          }

          // Drag and drop toolkit
          if (id.includes("@dnd-kit")) {
            return "vendor-dnd";
          }

          // Radix UI primitives & floating-ui (grouped together to prevent circular chunking)
          if (id.includes("@radix-ui") || id.includes("@floating-ui")) {
            return "vendor-radix";
          }

          // React core runtime
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          // UI components and helpers
          if (
            id.includes("react-colorful") ||
            id.includes("axios") ||
            id.includes("lucide-react") ||
            id.includes("sonner") ||
            id.includes("cmdk")
          ) {
            return "vendor-ui";
          }

          // General styling & formatting utilities
          if (
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("class-variance-authority") ||
            id.includes("date-fns")
          ) {
            return "vendor-utils";
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
