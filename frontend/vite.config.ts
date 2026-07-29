import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        legacy({
            targets: ['defaults', 'not IE 11', 'iOS >= 13', 'Chrome >= 80'],
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        proxy: { '/api': 'http://localhost:8080' }
    },
    build: {
        target: 'es2015',
        rollupOptions: {
            output: {
                // Recharts faqat admin analitikada kerak. Uni AdminPanel ichiga
                // qo'shib yubormaymiz: admin shell tezroq parse bo'ladi va 500 kB
                // chunk chegarasidan oshmaydi.
                manualChunks(id) {
                    if (
                        id.includes('/node_modules/recharts/')
                        || id.includes('/node_modules/d3-')
                        || id.includes('/node_modules/@reduxjs/toolkit/')
                        || id.includes('/node_modules/redux/')
                    ) {
                        return 'charts-vendor'
                    }
                },
            },
        },
    }
})
