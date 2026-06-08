// ===================================================
// app.js - 전체 앱 조율 (컴포넌트 & 서비스 통합)
// ===================================================

import { mapComponent } from './components/MapComponent.js';
import { Dashboard } from './components/Dashboard.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { locationService } from './services/locationService.js';
import { notificationService } from './services/notificationService.js';

/**
 * App 클래스 - 모든 컴포넌트와 서비스를 조율합니다.
 */
class App {
  constructor() {
    this._dashboard = null;
    this._settingsPanel = null;
    this._destination = null;
    this._isTracking = false;

    // 패널 드래그 관련
    this._panelDragStart = null;
    this._panelStartHeight = null;
  }

  /**
   * 앱 초기화
   */
  async init() {
    console.log('[App] Initializing...');

    // 1. 컴포넌트 초기화
    mapComponent.init('map');
    this._dashboard = new Dashboard();
    this._settingsPanel = new SettingsPanel();

    // 2. 서비스 워커 등록
    await notificationService.registerServiceWorker();

    // 3. 초기 설정값 서비스에 적용
    locationService.setAlertRadius(this._settingsPanel.radius);
    locationService.setUpdateInterval(this._settingsPanel.interval);
    notificationService.setSoundEnabled(this._settingsPanel.sound);
    notificationService.setVibrationEnabled(this._settingsPanel.vibration);
    notificationService.setPushEnabled(this._settingsPanel.push);
    mapComponent.setAlertRadius(this._settingsPanel.radius);

    // 4. 이벤트 연결
    this._bindMapEvents();
    this._bindLocationEvents();
    this._bindUIEvents();
    this._bindSettingsEvents();
    this._bindSwEvents();

    // 5. 알림 권한 상태 업데이트
    this._updatePermissionStatus();

    // 6. 현재 위치 초기화 시도 (지도 센터링)
    this._initCurrentLocation();

    // 7. 패널 드래그 초기화
    this._initPanelDrag();

    // 8. 로딩 화면 제거
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      loadingScreen?.classList.add('hidden');
    }, 1200);

    console.log('[App] Ready');
  }

  // ── 지도 이벤트 ──────────────────────────────────

  _bindMapEvents() {
    // 지도 클릭 → 목적지 설정
    mapComponent.onMapClick(({ lat, lng }) => {
      this._setDestination(lat, lng);
    });

    // 마커 드래그 → 목적지 변경
    mapComponent.onDestinationChange(({ lat, lng }) => {
      this._destination = { lat, lng };
      locationService.setDestination(lat, lng);
      this._dashboard.setDestination({ lat, lng }, this._settingsPanel.radius);
    });

    // 내 위치 버튼
    document.getElementById('btn-my-location').addEventListener('click', () => {
      this._panToMyLocation();
    });

    // 목적지 초기화 버튼
    document.getElementById('btn-clear-destination').addEventListener('click', () => {
      this._clearDestination();
    });
  }

  // ── 위치 서비스 이벤트 ───────────────────────────

  _bindLocationEvents() {
    // 위치 업데이트
    locationService.onLocationUpdate(({ position, distance, distancePercent }) => {
      mapComponent.setMyLocation(position.lat, position.lng, position.accuracy);
      this._dashboard.setAccuracy(position.accuracy);

      if (distance !== null) {
        this._dashboard.setDistance(distance, distancePercent);
      }
    });

    // 도착 감지
    locationService.onArrival(async (data) => {
      console.log('[App] Arrived!', data);
      this._dashboard.setStatus('arrived', '🎯 도착!');

      // 알림 전송
      await notificationService.sendArrivalAlert(data);

      // 도착 오버레이 표시
      this._showArrivalOverlay(data);
    });

    // 위치 오류
    locationService.onError((error) => {
      console.error('[App] Location error:', error);
      this._dashboard.setStatus('error', `⚠️ ${error.message}`);

      if (this._isTracking) {
        this._stopTracking();
      }
    });
  }

  // ── UI 이벤트 ────────────────────────────────────

  _bindUIEvents() {
    // 시작/정지 버튼
    this._dashboard.onStartStop(() => {
      if (this._isTracking) {
        this._stopTracking();
      } else {
        this._startTracking();
      }
    });

    // 도착 오버레이 버튼
    document.getElementById('btn-arrival-continue').addEventListener('click', () => {
      this._hideArrivalOverlay();
      // 재도착 방지: 도착 상태 유지하며 계속 추적
      locationService._hasArrived = true;
    });

    document.getElementById('btn-arrival-stop').addEventListener('click', () => {
      this._hideArrivalOverlay();
      this._stopTracking();
    });

    // SW에서 추적 중지 명령
    window.addEventListener('sw:stop-tracking', () => {
      this._stopTracking();
    });
  }

  // ── 설정 이벤트 ──────────────────────────────────

  _bindSettingsEvents() {
    this._settingsPanel.onRadiusChange((radius) => {
      locationService.setAlertRadius(radius);
      mapComponent.setAlertRadius(radius);
      if (this._destination) {
        this._dashboard.setDestination(this._destination, radius);
      }
    });

    this._settingsPanel.onIntervalChange((interval) => {
      locationService.setUpdateInterval(interval);
    });

    this._settingsPanel.onSoundChange((enabled) => {
      notificationService.setSoundEnabled(enabled);
    });

    this._settingsPanel.onVibrationChange((enabled) => {
      notificationService.setVibrationEnabled(enabled);
    });

    this._settingsPanel.onPushChange((enabled) => {
      notificationService.setPushEnabled(enabled);
    });

    this._settingsPanel.onRequestPermission(async () => {
      const result = await notificationService.requestPermission();
      this._settingsPanel.updatePermissionStatus(result);
    });
  }

  // ── Service Worker 이벤트 ─────────────────────────

  _bindSwEvents() {
    // SW 업데이트 감지
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }

  // ── 추적 제어 ────────────────────────────────────

  _startTracking() {
    if (!this._destination) return;

    const started = locationService.startTracking();
    if (!started) return;

    this._isTracking = true;
    this._dashboard.setTracking(true);
    this._dashboard.setStatus('tracking', '📡 위치 추적중');

    // 패널 축소 (지도 더 잘 보이게)
    const panel = document.getElementById('bottom-panel');
    panel.classList.remove('expanded');
  }

  _stopTracking() {
    locationService.stopTracking();
    this._isTracking = false;
    this._dashboard.setTracking(false);
    this._dashboard.setStatus('idle', '추적 대기중');
    this._dashboard.setDistance(null);
    this._dashboard.setAccuracy(null);
  }

  // ── 목적지 관리 ──────────────────────────────────

  _setDestination(lat, lng) {
    this._destination = { lat, lng };
    locationService.setDestination(lat, lng);
    mapComponent.setDestination(lat, lng);
    this._dashboard.setDestination({ lat, lng }, this._settingsPanel.radius);

    // 힌트 숨기기
    document.getElementById('map-hint').classList.add('hidden');

    // 내 위치도 있으면 두 지점 모두 보이게 조절
    const lastPos = locationService.getLastPosition();
    if (lastPos) {
      mapComponent.fitToMarkers();
    } else {
      mapComponent.panTo(lat, lng, 15);
    }
  }

  _clearDestination() {
    this._destination = null;
    locationService.setDestination(null, null);
    mapComponent.clearDestination();
    this._dashboard.setDestination(null, this._settingsPanel.radius);
    this._dashboard.setDistance(null);

    if (this._isTracking) {
      this._stopTracking();
    }

    // 힌트 다시 보이기
    document.getElementById('map-hint').classList.remove('hidden');
  }

  // ── 내 위치 ──────────────────────────────────────

  async _initCurrentLocation() {
    try {
      const pos = await locationService.getCurrentPosition();
      const { latitude, longitude, accuracy } = pos.coords;
      mapComponent.setMyLocation(latitude, longitude, accuracy);
      mapComponent.panTo(latitude, longitude, 14);
      this._dashboard.setAccuracy(accuracy);
    } catch (err) {
      console.warn('[App] Could not get initial location:', err.message);
    }
  }

  _panToMyLocation() {
    const lastPos = locationService.getLastPosition();
    if (lastPos) {
      mapComponent.panTo(lastPos.lat, lastPos.lng, 16);
    } else {
      this._initCurrentLocation();
    }
  }

  // ── 도착 오버레이 ────────────────────────────────

  _showArrivalOverlay({ distance, destination }) {
    const overlay = document.getElementById('arrival-overlay');
    const distInfo = document.getElementById('arrival-distance-info');

    distInfo.textContent = `목적지: ${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`;

    overlay.classList.remove('hidden');
  }

  _hideArrivalOverlay() {
    const overlay = document.getElementById('arrival-overlay');
    overlay.classList.add('hidden');
  }

  // ── 알림 권한 ────────────────────────────────────

  _updatePermissionStatus() {
    const status = notificationService.getPermissionStatus();
    this._settingsPanel.updatePermissionStatus(status);
  }

  // ── 패널 드래그 (모바일) ─────────────────────────

  _initPanelDrag() {
    const panel = document.getElementById('bottom-panel');
    const handle = document.getElementById('panel-handle');

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;

    const onStart = (y) => {
      startY = y;
      startHeight = panel.offsetHeight;
      isDragging = true;
    };

    const onMove = (y) => {
      if (!isDragging) return;
      const delta = startY - y;
      const newHeight = Math.max(
        140,
        Math.min(window.innerHeight * 0.85, startHeight + delta)
      );
      panel.style.height = `${newHeight}px`;
      mapComponent.invalidateSize();
    };

    const onEnd = (y) => {
      if (!isDragging) return;
      isDragging = false;
      const delta = startY - y;

      // 스냅: 위로 충분히 드래그 → 확장 / 아래로 → 축소
      if (delta > 60) {
        panel.style.height = '';
        panel.classList.add('expanded');
      } else if (delta < -40) {
        panel.style.height = '';
        panel.classList.remove('expanded');
      } else {
        panel.style.height = '';
      }

      mapComponent.invalidateSize();
    };

    // 터치 이벤트
    handle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
    document.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY), { passive: true });
    document.addEventListener('touchend', (e) => onEnd(e.changedTouches[0].clientY), { passive: true });

    // 마우스 이벤트
    handle.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientY); });
    document.addEventListener('mousemove', (e) => onMove(e.clientY));
    document.addEventListener('mouseup', (e) => onEnd(e.clientY));

    // 패널 핸들 탭으로 토글
    handle.addEventListener('click', () => {
      panel.style.height = '';
      panel.classList.toggle('expanded');
      mapComponent.invalidateSize();
    });
  }
}

// 앱 인스턴스 생성 및 초기화
const app = new App();
export default app;
