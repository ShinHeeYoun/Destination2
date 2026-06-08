// ===================================================
// app.js - 전체 앱 조율 (컴포넌트 & 서비스 통합)
// ===================================================

import { mapComponent } from './components/MapComponent.js';
import { Dashboard } from './components/Dashboard.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { SearchComponent } from './components/SearchComponent.js';
import { FavoritesPanel } from './components/FavoritesPanel.js';
import { locationService } from './services/locationService.js';
import { notificationService } from './services/notificationService.js';
import { favoritesService } from './services/favoritesService.js';
import { searchService } from './services/searchService.js';

/**
 * App 클래스 - 모든 컴포넌트와 서비스를 조율합니다.
 */
class App {
  constructor() {
    this._dashboard = null;
    this._settingsPanel = null;
    this._searchComponent = null;
    this._favoritesPanel = null;

    // 현재 목적지 (위치 + 이름 포함)
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
    this._searchComponent = new SearchComponent();
    this._favoritesPanel = new FavoritesPanel();

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
    this._bindSearchEvents();
    this._bindFavoritesEvents();
    this._bindSwEvents();

    // 5. 알림 권한 상태 업데이트
    this._updatePermissionStatus();

    // 6. 즐겨찾기 버튼 배지 업데이트
    this._updateFavoritesBadge();

    // 7. 현재 위치 초기화 시도 (지도 센터링)
    this._initCurrentLocation();

    // 8. 패널 드래그 초기화
    this._initPanelDrag();

    // 9. 로딩 화면 제거
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      loadingScreen?.classList.add('hidden');
    }, 1200);

    console.log('[App] Ready');
  }

  // ── 지도 이벤트 ──────────────────────────────────

  _bindMapEvents() {
    // 지도 클릭 → 좌표 역지오코딩 후 목적지 설정
    mapComponent.onMapClick(async ({ lat, lng }) => {
      // 일단 좌표만 즉시 설정 (반응성 확보)
      this._setDestination({ lat, lng });
      // 역지오코딩으로 주소명 보완
      try {
        const name = await searchService.reverseGeocode(lat, lng);
        if (this._destination && this._destination.lat === lat && this._destination.lng === lng) {
          this._destination.displayName = name;
          this._dashboard.setDestination(this._destination, this._settingsPanel.radius);
        }
      } catch {}
    });

    // 마커 드래그 → 목적지 변경
    mapComponent.onDestinationChange(({ lat, lng }) => {
      const updated = { ...this._destination, lat, lng };
      this._destination = updated;
      locationService.setDestination(lat, lng);
      this._dashboard.setDestination(updated, this._settingsPanel.radius);
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

  // ── 검색 이벤트 ──────────────────────────────────

  _bindSearchEvents() {
    this._searchComponent.onSelect(({ lat, lng, displayName, address }) => {
      this._setDestination({ lat, lng, displayName, address });
    });
  }

  // ── 즐겨찾기 이벤트 ──────────────────────────────

  _bindFavoritesEvents() {
    // 즐겨찾기 항목 선택 → 목적지 설정
    this._favoritesPanel.onSelect((fav) => {
      this._setDestination({
        lat: fav.lat,
        lng: fav.lng,
        displayName: fav.nickname,
        address: fav.address,
      });
      this._searchComponent.setValue(fav.nickname);
    });

    // 목적지 카드의 저장 버튼
    this._dashboard.onSaveFavorite(() => {
      if (!this._destination) return;
      this._favoritesPanel.openSaveModal(this._destination);
    });

    // 데이터 변경 시 배지 업데이트
    favoritesService.onChange(() => {
      this._updateFavoritesBadge();
    });
  }

  // ── 위치 서비스 이벤트 ───────────────────────────

  _bindLocationEvents() {
    locationService.onLocationUpdate(({ position, distance, distancePercent }) => {
      mapComponent.setMyLocation(position.lat, position.lng, position.accuracy);
      this._dashboard.setAccuracy(position.accuracy);

      if (distance !== null) {
        this._dashboard.setDistance(distance, distancePercent);
      }
    });

    locationService.onArrival(async (data) => {
      console.log('[App] Arrived!', data);
      this._dashboard.setStatus('arrived', '도착');

      await notificationService.sendArrivalAlert(data);
      this._showArrivalOverlay(data);
    });

    locationService.onError((error) => {
      console.error('[App] Location error:', error);
      this._dashboard.setStatus('error', error.message);

      if (this._isTracking) {
        this._stopTracking();
      }
    });
  }

  // ── UI 이벤트 ────────────────────────────────────

  _bindUIEvents() {
    this._dashboard.onStartStop(() => {
      if (this._isTracking) {
        this._stopTracking();
      } else {
        this._startTracking();
      }
    });

    document.getElementById('btn-arrival-continue').addEventListener('click', () => {
      this._hideArrivalOverlay();
      locationService._hasArrived = true;
    });

    document.getElementById('btn-arrival-stop').addEventListener('click', () => {
      this._hideArrivalOverlay();
      this._stopTracking();
    });

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
    this._dashboard.setStatus('tracking', '위치 추적중');

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

  /**
   * 목적지 설정 (검색 결과, 지도 클릭, 즐겨찾기 모두 이 메서드로 통일)
   * @param {{ lat, lng, displayName?, address? }} dest
   */
  _setDestination(dest) {
    this._destination = dest;

    locationService.setDestination(dest.lat, dest.lng);
    mapComponent.setDestination(dest.lat, dest.lng);
    this._dashboard.setDestination(dest, this._settingsPanel.radius);

    // 힌트 숨기기
    document.getElementById('map-hint').classList.add('hidden');

    // 지도 이동
    const lastPos = locationService.getLastPosition();
    if (lastPos) {
      mapComponent.fitToMarkers();
    } else {
      mapComponent.panTo(dest.lat, dest.lng, 15);
    }
  }

  _clearDestination() {
    this._destination = null;
    locationService.setDestination(null, null);
    mapComponent.clearDestination();
    this._dashboard.setDestination(null, this._settingsPanel.radius);
    this._dashboard.setDistance(null);
    this._searchComponent.clear();

    if (this._isTracking) {
      this._stopTracking();
    }

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

    const name = this._destination?.displayName || '';
    distInfo.textContent = name
      ? `${name} (${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)})`
      : `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`;

    overlay.classList.remove('hidden');
  }

  _hideArrivalOverlay() {
    document.getElementById('arrival-overlay').classList.add('hidden');
  }

  // ── 알림 권한 ────────────────────────────────────

  _updatePermissionStatus() {
    const status = notificationService.getPermissionStatus();
    this._settingsPanel.updatePermissionStatus(status);
  }

  // ── 즐겨찾기 배지 ────────────────────────────────

  _updateFavoritesBadge() {
    const btn = document.getElementById('btn-open-favorites');
    if (!btn) return;
    const count = favoritesService.getAll().length;
    btn.classList.toggle('has-favorites', count > 0);
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

    handle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
    document.addEventListener('touchmove', (e) => onMove(e.touches[0].clientY), { passive: true });
    document.addEventListener('touchend', (e) => onEnd(e.changedTouches[0].clientY), { passive: true });

    handle.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientY); });
    document.addEventListener('mousemove', (e) => onMove(e.clientY));
    document.addEventListener('mouseup', (e) => onEnd(e.clientY));

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
