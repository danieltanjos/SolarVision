import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("apexcharts") || id.includes("react-apexcharts")) {
            return "charts";
          }

          if (id.includes("react-router")) {
            return "router";
          }

          if (id.includes("bootstrap")) {
            return "bootstrap";
          }

          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("/react/") || id.includes("\\react\\") || id.includes("scheduler")) {
            return "react-vendor";
          }

          return "vendor";
        }
      }
    }
  }
});
