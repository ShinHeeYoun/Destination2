// ===================================================
// searchService.js - 카카오 Maps JS SDK 지오코딩 서비스
//
// Kakao Maps JavaScript SDK의 services 라이브러리를 사용합니다.
// REST API 직접 호출 대비 CORS 문제 없이 브라우저에서 안정적으로 동작합니다.
//
// - Places: 키워드 검색 (건물명, 아파트명, 상호, 역명 등 POI)
// - Geocoder: 주소 검색 (도로명/지번) + 역지오코딩 (좌표 → 주소)
//
// 추후 다른 지오코딩 API로 교체 시 이 파일만 수정하면 됩니다.
// ===================================================

/**
 * Kakao Maps SDK services 객체 반환
 * SDK가 아직 초기화되지 않았으면 null 반환
 */
function getSdk() {
  return window.kakao?.maps?.services ?? null;
}

/**
 * SDK가 준비될 때까지 대기 (autoload=false 사용 시)
 * kakao.maps.load()가 콜백 기반이므로 Promise로 래핑
 */
function waitForSdk() {
  return new Promise((resolve, reject) => {
    if (!window.kakao) {
      reject(new Error('Kakao SDK script not loaded. Check index.html.'));
      return;
    }
    window.kakao.maps.load(() => {
      const sdk = window.kakao.maps.services;
      if (!sdk) {
        reject(new Error('Kakao Maps services library not available.'));
        return;
      }
      resolve(sdk);
    });
  });
}

let _sdkPromise = null;

/**
 * SDK를 한 번만 초기화하고 재사용
 * @returns {Promise<kakao.maps.services>}
 */
function loadSdk() {
  if (!_sdkPromise) {
    _sdkPromise = waitForSdk().catch((err) => {
      _sdkPromise = null; // 실패 시 재시도 가능하도록
      throw err;
    });
  }
  return _sdkPromise;
}

/**
 * @typedef {object} SearchResult
 * @property {string}  id
 * @property {string}  primaryName   - 장소명 또는 주소
 * @property {string}  secondaryName - 카테고리, 보조 주소 등
 * @property {string}  fullAddress   - 전체 도로명 주소
 * @property {number}  lat
 * @property {number}  lng
 * @property {'keyword'|'address'} type
 */

export class SearchService {
  constructor() {
    this._debounceTimer = null;
    this._debounceMs = 350;
  }

  /**
   * 장소 검색 (키워드 + 주소 병렬 실행 후 병합)
   * @param {string} query
   * @returns {Promise<SearchResult[]>}
   */
  async search(query) {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 1) return [];

    let sdk;
    try {
      sdk = await loadSdk();
    } catch (err) {
      console.error('[SearchService] SDK 로드 실패:', err.message);
      throw err;
    }

    const [keywordResult, addressResult] = await Promise.allSettled([
      this._keywordSearch(trimmed, sdk),
      this._addressSearch(trimmed, sdk),
    ]);

    const keyword = keywordResult.status === 'fulfilled' ? keywordResult.value : [];
    const address = addressResult.status === 'fulfilled' ? addressResult.value : [];

    // 주소 결과 우선 배치, 키워드 결과에서 중복 좌표(~10m) 제거 후 병합
    const merged = [...address];
    for (const kw of keyword) {
      const isDup = merged.some(
        (m) => Math.abs(m.lat - kw.lat) < 0.0001 && Math.abs(m.lng - kw.lng) < 0.0001
      );
      if (!isDup) merged.push(kw);
    }

    return merged.slice(0, 8);
  }

  /**
   * 좌표 → 주소 역지오코딩
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<string>}
   */
  async reverseGeocode(lat, lng) {
    let sdk;
    try {
      sdk = await loadSdk();
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    return new Promise((resolve) => {
      const geocoder = new sdk.Geocoder();
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status === sdk.Status.OK && result.length > 0) {
          const addr = result[0];
          const name =
            addr.road_address?.address_name ||
            addr.address?.address_name ||
            `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          resolve(name);
        } else {
          resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      });
    });
  }

  /**
   * 디바운스 래퍼
   */
  debounce(fn) {
    return (...args) => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => fn(...args), this._debounceMs);
    };
  }

  // ── Private ─────────────────────────────────────

  /**
   * 카카오 키워드 검색 — 장소명, 건물명, 아파트명, 역명, 상호 등
   */
  _keywordSearch(query, sdk) {
    return new Promise((resolve, reject) => {
      const ps = new sdk.Places();
      ps.keywordSearch(
        query,
        (data, status) => {
          if (status === sdk.Status.OK) {
            resolve(
              data.map((doc) => ({
                id: `kw_${doc.id}`,
                primaryName: doc.place_name,
                secondaryName: this._buildSecondary(doc),
                fullAddress: doc.road_address_name || doc.address_name || doc.place_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                type: 'keyword',
              }))
            );
          } else if (status === sdk.Status.ZERO_RESULT) {
            resolve([]);
          } else {
            reject(new Error(`키워드 검색 오류: ${status}`));
          }
        },
        { size: 7 }
      );
    });
  }

  /**
   * 카카오 주소 검색 — 도로명 주소, 지번 주소 직접 입력
   */
  _addressSearch(query, sdk) {
    return new Promise((resolve, reject) => {
      const geocoder = new sdk.Geocoder();
      geocoder.addressSearch(query, (data, status) => {
        if (status === sdk.Status.OK) {
          resolve(
            data.map((doc) => ({
              id: `addr_${doc.address_name}`,
              primaryName: doc.road_address?.address_name || doc.address_name,
              secondaryName: doc.address?.address_name || '',
              fullAddress: doc.road_address?.address_name || doc.address_name,
              lat: parseFloat(doc.y),
              lng: parseFloat(doc.x),
              type: 'address',
            }))
          );
        } else if (status === sdk.Status.ZERO_RESULT) {
          resolve([]);
        } else {
          reject(new Error(`주소 검색 오류: ${status}`));
        }
      });
    });
  }

  /**
   * 키워드 검색 결과의 부가 정보 조합
   */
  _buildSecondary(doc) {
    const parts = [];
    if (doc.category_group_name) parts.push(doc.category_group_name);
    if (doc.road_address_name) parts.push(doc.road_address_name);
    else if (doc.address_name) parts.push(doc.address_name);
    return parts.join(' · ');
  }
}

export const searchService = new SearchService();
