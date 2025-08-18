import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force Vite to use the ESM build of date-fns-tz
      "date-fns-tz": path.resolve(
        __dirname,
        "node_modules/date-fns-tz/index.mjs"
      ),
    },
  },
  optimizeDeps: {
    // Don't pre-bundle date-fns-tz as CJS
    exclude: ["date-fns-tz"],
  },
}));
