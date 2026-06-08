// ===================================================
// main.js - Vite 엔트리포인트
// ===================================================

import './styles/main.css';
import app from './app.js';

// DOM 준비 후 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  app.init().catch((err) => {
    console.error('[main] App initialization failed:', err);
  });
});
