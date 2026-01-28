import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': 'http://localhost:8080',
            '/ws': {
                target: 'ws://localhost:8080',
                ws: true
            },
            '/login': 'http://localhost:8080',
            '/register': 'http://localhost:8080',
            '/auth': 'http://localhost:8080'
        }
    }
})
