import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allows access from the network
    port: 5173, // Optional: Specify a custom port (default is 5173)
    strictPort: true,
    // https: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    allowedHosts: ["localhost"],
  },
});
