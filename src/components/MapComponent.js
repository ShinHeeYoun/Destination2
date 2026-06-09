// ===================================================
// MapComponent.js - Leaflet 지도 및 마커 관리
//
// 추후 네이버/카카오 API로 전환 시:
// - MapAdapter 인터페이스의 메서드 시그니처를 유지하면서
//   내부 구현만 교체하면 됩니다.
// ===================================================

import L from 'leaflet';

// Leaflet 아이콘 경로 수정 (Vite 환경)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * MapComponent - 지도 인터페이스 추상화
 *
 * 향후 네이버/카카오 맵으로 전환 시 이 클래스만 교체합니다.
 * 외부에서 사용하는 공개 API:
 *   - init(containerId)
 *   - setMyLocation(lat, lng, accuracy)
 *   - setDestination(lat, lng) / clearDestination()
 *   - setAlertRadius(meters)
 *   - fitToMarkers()
 *   - onMapClick(callback)
 *   - panTo(lat, lng)
 */
export class MapComponent {
  constructor() {
    this._map = null;
    this._myLocationMarker = null;
    this._myLocationCircle = null;
    this._destinationMarker = null;
    this._alertRadiusCircle = null;
    this._alertRadius = 500;
    this._onMapClickCallback = null;
    this._onDestinationChangeCallback = null;

    // 이동 경로 레이어
    this._routeLayers = []; // L.Polyline[]
  }

  /**
   * 지도 초기화
   * @param {string} containerId - 지도를 렌더링할 DOM element ID
   */
  init(containerId) {
    // 기본 위치: 서울 시청
    const defaultLat = 37.5665;
    const defaultLng = 126.9780;

    this._map = L.map(containerId, {
      center: [defaultLat, defaultLng],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });

    // OSM 타일 레이어 (다크 스타일)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this._map);

    // 줌 컨트롤 위치 조정
    this._map.zoomControl.setPosition('topright');

    // 지도 클릭 이벤트
    this._map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      this._onMapClickCallback?.({ lat, lng });
    });

    return this;
  }

  /**
   * 지도 클릭 콜백 등록
   */
  onMapClick(callback) {
    this._onMapClickCallback = callback;
  }

  /**
   * 목적지 변경 콜백 등록 (마커 드래그)
   */
  onDestinationChange(callback) {
    this._onDestinationChangeCallback = callback;
  }

  /**
   * 내 위치 마커 업데이트
   * @param {number} lat
   * @param {number} lng
   * @param {number} accuracy - GPS 정확도(미터)
   */
  setMyLocation(lat, lng, accuracy = 0) {
    const latlng = [lat, lng];

    if (!this._myLocationMarker) {
      // 커스텀 펄스 마커 생성
      const icon = L.divIcon({
        className: 'my-location-marker',
        html: '<div class="my-location-pulse"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      this._myLocationMarker = L.marker(latlng, {
        icon,
        zIndexOffset: 1000,
        interactive: false,
      }).addTo(this._map);
    } else {
      this._myLocationMarker.setLatLng(latlng);
    }

    // 정확도 원
    if (accuracy > 0) {
      if (!this._myLocationCircle) {
        this._myLocationCircle = L.circle(latlng, {
          radius: accuracy,
          color: '#6c63ff',
          fillColor: '#6c63ff',
          fillOpacity: 0.08,
          weight: 1,
          interactive: false,
        }).addTo(this._map);
      } else {
        this._myLocationCircle.setLatLng(latlng);
        this._myLocationCircle.setRadius(accuracy);
      }
    }
  }

  /**
   * 목적지 마커 설정
   * @param {number} lat
   * @param {number} lng
   */
  setDestination(lat, lng) {
    const latlng = [lat, lng];

    // 커스텀 목적지 마커 SVG
    const icon = L.divIcon({
      className: 'destination-marker-icon',
      html: `
        <svg viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="52">
          <filter id="shadow">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
          </filter>
          <path d="M20 2C10.059 2 2 10.059 2 20C2 32 20 50 20 50C20 50 38 32 38 20C38 10.059 29.941 2 20 2Z"
            fill="#ef4444" filter="url(#shadow)"/>
          <circle cx="20" cy="20" r="8" fill="white" opacity="0.95"/>
          <circle cx="20" cy="20" r="4" fill="#ef4444"/>
        </svg>
      `,
      iconSize: [40, 52],
      iconAnchor: [20, 50],
      popupAnchor: [0, -52],
    });

    if (!this._destinationMarker) {
      this._destinationMarker = L.marker(latlng, {
        icon,
        draggable: true,
        zIndexOffset: 500,
      }).addTo(this._map);

      // 드래그 이벤트
      this._destinationMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        this._updateRadiusCircle(pos.lat, pos.lng);
        this._onDestinationChangeCallback?.({ lat: pos.lat, lng: pos.lng });
      });

      this._destinationMarker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        this._updateRadiusCircle(pos.lat, pos.lng);
      });

      // 툴팁
      this._destinationMarker.bindTooltip('📍 목적지 (드래그로 이동)', {
        permanent: false,
        direction: 'top',
        className: 'custom-tooltip',
      });
    } else {
      this._destinationMarker.setLatLng(latlng);
    }

    // 알림 반경 원
    this._updateRadiusCircle(lat, lng);
  }

  /**
   * 목적지 마커 제거
   */
  clearDestination() {
    if (this._destinationMarker) {
      this._map.removeLayer(this._destinationMarker);
      this._destinationMarker = null;
    }
    if (this._alertRadiusCircle) {
      this._map.removeLayer(this._alertRadiusCircle);
      this._alertRadiusCircle = null;
    }
  }

  /**
   * 알림 반경 설정
   */
  setAlertRadius(meters) {
    this._alertRadius = meters;
    if (this._destinationMarker) {
      const pos = this._destinationMarker.getLatLng();
      this._updateRadiusCircle(pos.lat, pos.lng);
    }
  }

  /**
   * 지도를 마커들에 맞게 조절
   */
  fitToMarkers() {
    const markers = [];
    if (this._myLocationMarker) markers.push(this._myLocationMarker.getLatLng());
    if (this._destinationMarker) markers.push(this._destinationMarker.getLatLng());

    if (markers.length >= 2) {
      const bounds = L.latLngBounds(markers);
      this._map.fitBounds(bounds, { padding: [60, 60] });
    } else if (markers.length === 1) {
      this._map.setView(markers[0], 15, { animate: true });
    }
  }

  /**
   * 특정 좌표로 지도 이동
   */
  panTo(lat, lng, zoom = null) {
    const options = { animate: true, duration: 0.8 };
    if (zoom) {
      this._map.setView([lat, lng], zoom, options);
    } else {
      this._map.panTo([lat, lng], options);
    }
  }

  /**
   * 지도 크기 재계산 (패널 크기 변경 후 호출)
   */
  invalidateSize() {
    this._map?.invalidateSize();
  }

  // ── Private ─────────────────────────────────────

  /**
   * 이동 경로 그리기
   * @param {Array<{points:[number,number][], isDashed:boolean}>} segments
   */
  drawRoute(segments) {
    // 기존 경로 레이어 제거
    this._routeLayers.forEach((l) => this._map.removeLayer(l));
    this._routeLayers = [];

    const primaryColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#6c63ff';

    segments.forEach(({ points, isDashed }) => {
      if (points.length < 2) return;

      const polyline = L.polyline(points, {
        color: primaryColor,
        weight: isDashed ? 3 : 4,
        opacity: isDashed ? 0.55 : 0.85,
        dashArray: isDashed ? '10 8' : null,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
        className: isDashed ? 'route-gap' : 'route-solid',
      }).addTo(this._map);

      this._routeLayers.push(polyline);
    });
  }

  /**
   * 이동 경로 전체 삭제
   */
  clearRoute() {
    this._routeLayers.forEach((l) => this._map.removeLayer(l));
    this._routeLayers = [];
  }

  _updateRadiusCircle(lat, lng) {
    if (!this._alertRadiusCircle) {
      this._alertRadiusCircle = L.circle([lat, lng], {
        radius: this._alertRadius,
        color: '#6c63ff',
        fillColor: '#6c63ff',
        fillOpacity: 0.06,
        weight: 2,
        dashArray: '8 6',
        interactive: false,
        className: 'radius-circle',
      }).addTo(this._map);
    } else {
      this._alertRadiusCircle.setLatLng([lat, lng]);
      this._alertRadiusCircle.setRadius(this._alertRadius);
    }
  }
}

// 싱글톤 인스턴스
export const mapComponent = new MapComponent();
