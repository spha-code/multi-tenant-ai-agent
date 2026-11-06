import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server runs inside docker-compose with the project bind-mounted,
// so host/port must be reachable from outside the container.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
});
