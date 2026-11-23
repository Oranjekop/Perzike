import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    server: {
      host: '127.0.0.1'
    },
    optimizeDeps: {
      // The YAML worker imports this CommonJS dependency outside Vite's initial scan.
      include: ['monaco-yaml > path-browserify']
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          floating: resolve('src/renderer/floating.html'),
          traymenu: resolve('src/renderer/traymenu.html')
        }
      }
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
