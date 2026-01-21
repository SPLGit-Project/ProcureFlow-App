import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

// Simple plugin to generate version.json on build
const versionGenerator = () => {
    return {
        name: 'version-generator',
        buildStart() {
            const versionData = { version: Date.now().toString() };
            const publicDir = path.resolve(__dirname, 'public');
            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
            fs.writeFileSync(path.resolve(publicDir, 'version.json'), JSON.stringify(versionData, null, 2));
            console.log('Vite: version.json generated.');
        }
    };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), versionGenerator()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              ui: ['lucide-react', 'recharts'],
              db: ['@supabase/supabase-js']
            }
          }
        },
        chunkSizeWarningLimit: 1000
      }

    };
});
