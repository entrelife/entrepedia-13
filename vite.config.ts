import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Using `host: true` avoids IPv6 literal edge-cases in some hosted preview environments
    // and tends to produce more stable HMR client define injection.
    host: true,
    port: 8080,
    hmr: {
      overlay: false,
      // Hosted previews are served over HTTPS; force the HMR client to use secure WS.
      protocol: "wss",
      clientPort: 443,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
