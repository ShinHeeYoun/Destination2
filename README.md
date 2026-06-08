# 목적지 도착 알림 (Destination Alert PWA)

지도에서 목적지를 지정하면 실시간 위치를 추적하여, 지정 반경 안에 진입했을 때 알림을 보내는 웹 애플리케이션이다.
별도 앱 설치 없이 브라우저에서 동작하며, PWA(Progressive Web App) 방식으로 구현되어 있어 모바일 홈 화면에 추가하여 네이티브 앱처럼 사용할 수 있다.

> Built with [Antigravity](https://antigravity.dev) — Google DeepMind의 AI 코딩 에이전트를 통해 개발되었습니다.

---

## 개발 환경 및 기술 스택

| 항목 | 내용 |
|------|------|
| 언어 | Vanilla JavaScript (ES Modules) |
| 빌드 도구 | Vite 8 |
| 지도 라이브러리 | Leaflet.js 1.9.4 |
| 지도 타일 | CartoDB Dark Matter (OpenStreetMap 기반, API 키 불필요) |
| 스타일 | Vanilla CSS (CSS Custom Properties, Glassmorphism) |
| PWA | Web App Manifest + Service Worker API |

---

## 구현 기능 및 사용 기술 상세

### 지도 인터페이스 — Leaflet.js + OpenStreetMap

Leaflet.js를 사용하여 지도를 렌더링한다. 타일 레이어는 CartoDB의 `dark_all` 스타일을 사용하며, OpenStreetMap 데이터를 기반으로 하므로 별도 API 키가 필요 없다.

목적지 마커는 `L.divIcon`으로 직접 SVG를 렌더링하여 커스텀 디자인을 적용했으며, `draggable: true` 옵션으로 드래그 이동이 가능하다. 지도 클릭 이벤트(`map.on('click')`)와 마커 드래그 이벤트(`marker.on('dragend')`) 두 가지 방식으로 목적지를 설정할 수 있다.

현재 위치는 `L.divIcon`에 CSS 애니메이션(`@keyframes`)을 적용한 펄스(pulse) 마커로 표시되며, 알림 반경은 `L.circle`의 `dashArray` 옵션으로 점선 원을 그려 시각화한다.

`MapComponent` 클래스는 Leaflet에 종속되지 않는 인터페이스(`setMyLocation`, `setDestination`, `setAlertRadius` 등)로 추상화되어 있어, 추후 네이버 지도 API나 카카오 지도 API로 교체할 때 이 클래스 내부만 수정하면 된다.

### 실시간 위치 추적 — HTML5 Geolocation API

`navigator.geolocation.watchPosition()`을 사용하여 위치 변화를 지속적으로 구독한다. `enableHighAccuracy: true` 옵션으로 GPS 우선 측위를 요청하며, `maximumAge`를 업데이트 주기와 동기화하여 불필요한 측위 요청을 줄인다.

위치 업데이트 주기는 5초 / 10초 / 30초 중 선택 가능하며, 주기 변경 시 기존 `watchPosition`을 `clearWatch()`로 해제하고 새 옵션으로 재등록한다.

### 거리 계산 — Haversine 공식

현재 위치와 목적지 사이의 직선거리를 Haversine 공식으로 계산한다. 위도·경도 좌표를 라디안으로 변환한 뒤 구면 삼각법을 적용하여 지구 곡률을 반영한 실제 거리(미터 단위)를 구한다. 외부 라이브러리 없이 `locationService.js` 내에 직접 구현되어 있다.

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
d = 2R × atan2(√a, √(1−a))
```

거리가 설정된 반경 이하로 줄어들면 도착 이벤트를 발생시키고, 이후 재도착 방지를 위해 플래그(`_hasArrived`)를 세팅한다.

### 백그라운드 알림 — Service Worker + Web Notification API

Service Worker(`public/service-worker.js`)를 등록하여 앱이 백그라운드 상태이거나 화면이 꺼진 경우에도 알림이 표시되도록 구성했다.

도착 감지 시 메인 스레드에서 SW에 `postMessage({ type: 'ARRIVAL_ALERT' })`를 전송하면, SW가 `self.registration.showNotification()`으로 시스템 알림을 표시한다. 알림에는 `actions` 옵션으로 "확인"과 "추적 중지" 버튼을 추가했으며, "추적 중지" 선택 시 SW가 메인 스레드로 역방향 `postMessage`를 보내 추적을 중단한다.

Service Worker는 Cache API를 사용해 정적 자산을 캐싱하며, fetch 이벤트에서 캐시 우선 전략을 적용한다. OpenStreetMap 타일 요청은 캐싱 대상에서 제외한다.

### 알림음 — Web Audio API

MP3 파일 없이 Web Audio API만으로 알림 멜로디를 생성한다. `AudioContext`에서 `OscillatorNode`와 `GainNode`를 조합하여 C5 → E5 → G5의 3음 순서로 재생한다. `GainNode`의 `linearRampToValueAtTime`으로 페이드인·아웃을 처리하여 클릭음 없이 자연스러운 음을 만든다.

### 진동 — Vibration API

`navigator.vibrate([300, 100, 300, 100, 600])` 패턴으로 도착 시 진동을 울린다. 진동 지원 여부를 런타임에 확인(`'vibrate' in navigator`)하여 미지원 환경에서는 무시한다.

### 환경설정 — localStorage

알림 반경(100m / 300m / 500m / 1km), 위치 업데이트 주기(5s / 10s / 30s), 알림 방식(소리 / 진동 / 푸시) 설정을 `localStorage`에 JSON 직렬화하여 저장한다. 앱 재실행 시 저장된 설정을 자동으로 복원한다.

### 반응형 레이아웃 — CSS Custom Properties

모바일에서는 지도가 상단을 차지하고 하단 패널이 슬라이드업 방식으로 표시된다. 패널은 터치/마우스 드래그로 높이를 조절할 수 있으며, 스냅 기능으로 확장·축소 상태로 고정된다.

데스크탑(768px 이상)에서는 CSS `flex-direction: row`로 레이아웃이 전환되어 지도가 좌측, 설정 패널이 우측 고정 사이드바로 배치된다.

---

## 프로젝트 구조

```
├── public/
│   ├── manifest.json          # PWA 매니페스트 (앱 이름, 아이콘, 테마색)
│   ├── service-worker.js      # 백그라운드 캐싱 및 푸시 알림
│   └── icons/                 # PWA 아이콘 (192×192, 512×512)
└── src/
    ├── components/
    │   ├── MapComponent.js    # Leaflet 지도 추상화 레이어
    │   ├── Dashboard.js       # 거리·상태 표시 UI
    │   └── SettingsPanel.js   # 설정 패널 (localStorage 동기화)
    ├── services/
    │   ├── locationService.js # Geolocation 추적 + Haversine 거리 계산
    │   └── notificationService.js # 알림·진동·SW 메시지 관리
    ├── styles/main.css        # 전역 스타일 및 CSS 변수
    ├── app.js                 # 컴포넌트·서비스 조율
    └── main.js                # Vite 진입점
```

---

## 실행 방법

```bash
npm install
npm run dev
```

개발 서버 실행 후 `http://localhost:5173`에서 확인한다.
Service Worker는 `localhost`에서도 정상 등록되므로 HTTPS 없이 PWA 기능 전체를 테스트할 수 있다.

Chrome DevTools → Application 탭에서 Service Worker 등록 상태를 확인하고,
Sensors 탭에서 가상 GPS 좌표를 설정하면 실제 이동 없이 도착 시뮬레이션이 가능하다.

---

## 향후 계획

- 네이버 지도 / 카카오 지도 API 전환 (`MapComponent` 인터페이스 유지, 내부 구현만 교체)
- 도착 이력 기록 및 통계
- 경유지 다중 설정
- Geofence 형태의 진입·이탈 양방향 감지
