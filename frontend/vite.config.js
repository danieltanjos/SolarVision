import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // O chunk da ApexCharts (~580 kB) só carrega na página de Monitoramento.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        // Bibliotecas num chunk próprio: continuam em cache quando só o código do app muda.
        manualChunks(id) {
          if (id.includes("node_modules") && !id.includes("apexcharts")) return "vendor";
        }
      }
    }
  }
});
