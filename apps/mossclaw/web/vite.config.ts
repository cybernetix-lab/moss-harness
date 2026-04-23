import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mossclaw/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
})
