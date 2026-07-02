import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 1080,
    strictPort: true, // fail loudly if 1080 is taken instead of silently using another port
    open: true,       // auto-open the browser on dev start
    host: true,       // also expose on your LAN (test from phone via your machine's IP)
  },
});