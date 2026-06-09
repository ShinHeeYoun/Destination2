import { defineConfig } from 'vite';

export default defineConfig({
  // 개발 서버 설정
  server: {
    port: 5173,
    open: true,
    // HTTPS 비활성화 (로컬 테스트)
    // Service Worker는 localhost에서 HTTP로도 동작함
    headers: {
      // PWA 캐싱 제어
      'Service-Worker-Allowed': '/',
    },
  },

  // 빌드 출력 설정
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Vite 8(rolldown)은 manualChunks를 Function 형태로만 허용
        manualChunks(id) {
          if (id.includes('node_modules/leaflet')) return 'leaflet';
        },
      },
    },
  },

  // public 폴더 (service-worker.js, manifest.json, icons/)
  publicDir: 'public',
});
