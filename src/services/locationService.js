// ===================================================
// locationService.js - 위치 추적 & Haversine 거리 계산
// ===================================================

/**
 * 지구 반지름 (미터)
 */
const EARTH_RADIUS_M = 6371000;

/**
 * Haversine 공식으로 두 좌표 간 직선거리 계산
 * @param {number} lat1 - 시작점 위도
 * @param {number} lon1 - 시작점 경도
 * @param {number} lat2 - 끝점 위도
 * @param {number} lon2 - 끝점 경도
 * @returns {number} 거리 (미터)
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * 거리를 사람이 읽기 좋은 형태로 변환
 * @param {number} meters - 미터 단위 거리
 * @returns {{ value: string, unit: string }}
 */
export function formatDistance(meters) {
  if (meters >= 1000) {
    return {
      value: (meters / 1000).toFixed(1),
      unit: 'km',
    };
  }
  return {
    value: Math.round(meters).toString(),
    unit: 'm',
  };
}

/**
 * LocationService 클래스 - GPS 위치 추적 관리
 */
export class LocationService {
  constructor() {
    this._watchId = null;
    this._destination = null;
    this._alertRadius = 500; // 기본 반경 500m
    this._updateInterval = 10000; // 기본 10초

    // 콜백 핸들러
    this._onLocationUpdate = null;
    this._onArrival = null;
    this._onError = null;

    // 상태
    this._isTracking = false;
    this._hasArrived = false;
    this._lastPosition = null;
  }

  /**
   * 목적지 설정
   */
  setDestination(lat, lng) {
    this._destination = { lat, lng };
    this._hasArrived = false; // 목적지 바뀌면 도착 상태 초기화
  }

  /**
   * 알림 반경 설정 (미터)
   */
  setAlertRadius(meters) {
    this._alertRadius = meters;
  }

  /**
   * 위치 업데이트 주기 설정 (밀리초)
   */
  setUpdateInterval(ms) {
    this._updateInterval = ms;
    // 추적 중이면 재시작
    if (this._isTracking) {
      this.stopTracking();
      this.startTracking();
    }
  }

  /**
   * 위치 업데이트 콜백 등록
   */
  onLocationUpdate(callback) {
    this._onLocationUpdate = callback;
  }

  /**
   * 도착 콜백 등록
   */
  onArrival(callback) {
    this._onArrival = callback;
  }

  /**
   * 오류 콜백 등록
   */
  onError(callback) {
    this._onError = callback;
  }

  /**
   * 위치 추적 시작
   */
  startTracking() {
    if (!navigator.geolocation) {
      this._onError?.({ code: -1, message: '이 브라우저는 위치 서비스를 지원하지 않습니다.' });
      return false;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: this._updateInterval,
    };

    this._isTracking = true;
    this._hasArrived = false;

    this._watchId = navigator.geolocation.watchPosition(
      (position) => this._handlePosition(position),
      (error) => this._handleError(error),
      options
    );

    return true;
  }

  /**
   * 위치 추적 정지
   */
  stopTracking() {
    if (this._watchId !== null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    this._isTracking = false;
  }

  /**
   * 추적 중인지 반환
   */
  isTracking() {
    return this._isTracking;
  }

  /**
   * 마지막 위치 반환
   */
  getLastPosition() {
    return this._lastPosition;
  }

  /**
   * 현재 위치 한 번 요청 (추적 없이)
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }

  // ── Private Methods ─────────────────────────────

  _handlePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = position.timestamp;

    this._lastPosition = { lat: latitude, lng: longitude, accuracy, timestamp };

    // 거리 계산
    let distance = null;
    let distancePercent = 0;

    if (this._destination) {
      distance = haversineDistance(
        latitude,
        longitude,
        this._destination.lat,
        this._destination.lng
      );

      // 거리 비율 (알림 반경 대비, 100% = 반경 밖, 0% = 도착)
      distancePercent = Math.min(100, (distance / (this._alertRadius * 5)) * 100);

      // 도착 감지
      if (distance <= this._alertRadius && !this._hasArrived) {
        this._hasArrived = true;
        this._onArrival?.({
          position: this._lastPosition,
          distance,
          destination: this._destination,
        });
      }
    }

    this._onLocationUpdate?.({
      position: this._lastPosition,
      distance,
      distancePercent: 100 - distancePercent,
      destination: this._destination,
    });
  }

  _handleError(error) {
    const messages = {
      1: '위치 접근 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.',
      2: '현재 위치를 가져올 수 없습니다. GPS 신호를 확인해 주세요.',
      3: '위치 요청 시간이 초과되었습니다. 다시 시도해 주세요.',
    };

    this._onError?.({
      code: error.code,
      message: messages[error.code] || '알 수 없는 위치 오류가 발생했습니다.',
    });
  }
}

// 싱글톤 인스턴스
export const locationService = new LocationService();
