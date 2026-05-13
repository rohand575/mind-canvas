import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isElectron = process.env.ELECTRON === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isElectron ? './' : '/',
})
