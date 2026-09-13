import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// PORT lets preview tooling hand the dev server a free port when 5173 is taken.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
  },
});
