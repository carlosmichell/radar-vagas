import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
    envDir: workspaceRoot,
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3333',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
})
