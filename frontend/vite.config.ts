import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        legacy({
            targets: ['defaults', 'not IE 11', 'iOS >= 13', 'Chrome >= 80'],
            additionalLegacyPolyfills: ['regenerator-runtime/runtime']
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        proxy: { '/api': 'http://localhost:8080' }
    },
    build: {
        target: 'es2015',
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'charts': ['recharts'],
                    'markdown': ['react-markdown', 'katex'],
                }
            }
        }
    }
})
