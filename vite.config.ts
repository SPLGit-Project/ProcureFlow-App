import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { execSync } from 'child_process';

// Generate timestamp once per build
const BUILD_TIMESTAMP = Date.now().toString();

// Get git commit hash (if available)
function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (error) {
    console.warn('Vite: Could not get git hash, using fallback');
    return 'unknown';
  }
}

// Enhanced version generator plugin
const versionGenerator = () => {
  return {
    name: 'version-generator',
    buildStart() {
      const gitHash = getGitHash();
      const versionData = {
        version: BUILD_TIMESTAMP,
        buildTime: new Date().toISOString(),
        gitHash: gitHash,
        environment: process.env.NODE_ENV || 'development'
      };
      
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
      
      fs.writeFileSync(
        path.resolve(publicDir, 'version.json'),
        JSON.stringify(versionData, null, 2)
      );
      
      console.log('Vite: version.json generated');
      console.log('  - Version:', BUILD_TIMESTAMP);
      console.log('  - Git Hash:', gitHash);
      console.log('  - Environment:', versionData.environment);
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
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(BUILD_TIMESTAMP) 
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            // Use content-based hashing for cache busting
            entryFileNames: 'assets/[name].[hash].js',
            chunkFileNames: 'assets/[name].[hash].js',
            assetFileNames: 'assets/[name].[hash].[ext]',
            
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              ui: ['lucide-react', 'recharts'],
              db: ['@supabase/supabase-js']
            }
          }
        },
        chunkSizeWarningLimit: 1000,
        // Ensure source maps for debugging
        sourcemap: mode === 'production' ? false : true
      }

    };
});
