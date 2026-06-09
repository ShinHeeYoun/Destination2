// ===================================================
// trackingService.js - 이동 경로 기록 및 총 거리 계산
//
// 역할:
//   - 위치 포인트를 순서대로 저장
//   - 연속된 두 포인트 간격이 GAP_THRESHOLD(30초) 이상이면
//     "신호 끊김 구간(gap)"으로 표시 (지하철 터널 등)
//   - Haversine 공식으로 총 이동 거리 누적
//   - 경로 데이터를 세그먼트(연속 구간 / 갭 구간)로 분리하여 반환
// ===================================================

/** @typedef {{ lat: number, lng: number, ts: number, gap: boolean }} PathPoint */
/** @typedef {{ points: [number,number][], isDashed: boolean }} RouteSegment */

const GAP_THRESHOLD_MS = 30_000; // 30초 이상 간격 → 신호 끊김 처리

/**
 * Haversine 공식으로 두 좌표 사이의 거리(미터) 계산
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // 지구 반지름 (m)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class TrackingService {
  constructor() {
    /** @type {PathPoint[]} */
    this._path = [];
    this._totalDistance = 0; // 미터
  }

  /**
   * 새 위치 포인트 추가
   * @param {number} lat
   * @param {number} lng
   * @returns {{ totalDistance: number, isGap: boolean }}
   */
  addPoint(lat, lng) {
    const now = Date.now();
    const prev = this._path[this._path.length - 1];

    // 첫 포인트이거나 직전 포인트와 동일 좌표면 무시
    if (prev && Math.abs(prev.lat - lat) < 1e-7 && Math.abs(prev.lng - lng) < 1e-7) {
      return { totalDistance: this._totalDistance, isGap: false };
    }

    const isGap = !!prev && now - prev.ts > GAP_THRESHOLD_MS;

    if (prev) {
      this._totalDistance += haversineMeters(prev.lat, prev.lng, lat, lng);
    }

    this._path.push({ lat, lng, ts: now, gap: isGap });
    return { totalDistance: this._totalDistance, isGap };
  }

  /**
   * 경로를 렌더링용 세그먼트 배열로 반환
   * - 갭 구간: 이전 마지막 포인트 → 갭 포인트 → 다음 실선 시작점 (점선)
   * - 일반 구간: 연속 포인트들 (실선)
   *
   * @returns {RouteSegment[]}
   */
  getSegments() {
    if (this._path.length < 2) return [];

    const segments = [];
    let currentSolid = [this._path[0]];

    for (let i = 1; i < this._path.length; i++) {
      const p = this._path[i];
      if (p.gap) {
        // 이전 실선 구간 마감
        if (currentSolid.length >= 2) {
          segments.push({ points: currentSolid.map((x) => [x.lat, x.lng]), isDashed: false });
        }
        // 갭 구간: 직전 포인트 → 현재 포인트 (점선)
        const prev = this._path[i - 1];
        segments.push({ points: [[prev.lat, prev.lng], [p.lat, p.lng]], isDashed: true });
        // 새 실선 구간 시작
        currentSolid = [p];
      } else {
        currentSolid.push(p);
      }
    }

    if (currentSolid.length >= 2) {
      segments.push({ points: currentSolid.map((x) => [x.lat, x.lng]), isDashed: false });
    }

    return segments;
  }

  /** 경로 및 거리 초기화 */
  reset() {
    this._path = [];
    this._totalDistance = 0;
  }

  get totalDistance() {
    return this._totalDistance;
  }

  get pointCount() {
    return this._path.length;
  }
}

export const trackingService = new TrackingService();
