// ===================================================
// Service Worker - 백그라운드 위치 알림 처리
// ===================================================

const CACHE_NAME = 'destination-alert-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// ── 설치 ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── 활성화 ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch 캐싱 전략 ───────────────────────────────
self.addEventListener('fetch', (event) => {
  // 외부 타일 요청은 캐싱 제외
  if (event.request.url.includes('tile.openstreetmap')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});

// ── 메인 스레드로부터 메시지 수신 ─────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ARRIVAL_ALERT') {
    const { destination, distance } = event.data.payload;
    showArrivalNotification(destination, distance);
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── 도착 알림 표시 ────────────────────────────────
function showArrivalNotification(destination, distance) {
  const title = '🎯 목적지 도착!';
  const options = {
    body: `목적지까지 ${Math.round(distance)}m 남았습니다. 곧 도착합니다!`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'arrival-alert',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
    actions: [
      { action: 'dismiss', title: '확인' },
      { action: 'stop', title: '추적 중지' }
    ],
    data: { destination, distance }
  };

  self.registration.showNotification(title, options);
}

// ── 알림 클릭 이벤트 ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'stop') {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'STOP_TRACKING' });
      });
    });
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});
