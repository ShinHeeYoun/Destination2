# 🗺️ 목적지 도착 알림 (Destination Alert PWA)

실시간 위치 추적으로 목적지 도착 시 알림을 보내주는 **PWA(Progressive Web App)** 웹 애플리케이션입니다.

## ✨ 주요 기능

- **🗺️ 지도 인터페이스** - Leaflet.js + OpenStreetMap (API 키 불필요)
- **📍 목적지 설정** - 지도 클릭 또는 마커 드래그
- **📡 실시간 위치 추적** - HTML5 Geolocation API
- **📏 Haversine 거리 계산** - 실시간 직선거리 표시 (m/km)
- **🔔 백그라운드 알림** - Service Worker + Web Notification API
- **🔊 알림음** - Web Audio API (알림 멜로디 자동 생성)
- **📳 진동** - Vibration API
- **⚙️ 환경설정** - 반경/주기/알림방식 설정 (localStorage 저장)
- **📱 반응형** - 모바일/데스크탑 모두 최적화

## 🏗️ 아키텍처

```
src/
├── components/
│   ├── MapComponent.js      # Leaflet 지도, 마커 관리
│   ├── Dashboard.js         # 거리/상태 표시
│   └── SettingsPanel.js     # 환경설정 패널
├── services/
│   ├── locationService.js   # GPS 추적 + Haversine 공식
│   └── notificationService.js # 알림/진동/SW 관리
├── styles/main.css          # 다크모드 Glassmorphism CSS
├── app.js                   # 전체 조율
└── main.js                  # Vite 엔트리포인트

public/
├── manifest.json            # PWA 매니페스트
├── service-worker.js        # 백그라운드 서비스 워커
└── icons/                   # PWA 아이콘
```

## 🚀 로컬 실행

```bash
npm install
npm run dev
```

## 🛠️ 기술 스택

| 항목 | 기술 |
|------|------|
| 빌드 도구 | Vite |
| 지도 | Leaflet.js + CartoDB Dark Tiles |
| 스타일 | Modern CSS (Glassmorphism, CSS Variables) |
| PWA | Service Worker + Web Manifest |
| 언어 | Vanilla JavaScript (ES Modules) |

## 📱 PWA 설치

모바일 브라우저에서 "홈 화면에 추가"로 앱처럼 설치 가능합니다.

## 🔮 향후 계획

- 네이버/카카오 맵 API 전환 (MapComponent 인터페이스 준수)
- 도착 이력 기록
- 경로 표시 기능
