import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: ["chrome120", "firefox121"],
  },
  server: {
    port: 5173,
  },
});
