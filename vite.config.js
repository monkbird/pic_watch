import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 关键：确保 Electron 加载资源使用相对路径
  server: {
    port: 5173
  }
})