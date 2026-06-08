// ===================================================
// searchService.js - 카카오 로컬 REST API 지오코딩 서비스
//
// 카카오 로컬 REST API를 사용하여 한국어 주소 및 장소명을 검색합니다.
// dapi.kakao.com은 Access-Control-Allow-Origin: * 를 반환하므로
// 브라우저에서 직접 호출 가능합니다.
//
// 사용 API:
// - GET /v2/local/search/keyword.json : 장소 키워드 검색 (아파트명, 역명, 상호 등)
// - GET /v2/local/search/address.json : 주소 검색 (도로명, 지번)
// - GET /v2/local/geo/coord2address.json : 역지오코딩 (좌표 → 주소)
//
// 인증: Authorization: KakaoAK {REST_API_KEY} 헤더
// ===================================================

const KAKAO_LOCAL = 'https://dapi.kakao.com/v2/local';
const REST_API_KEY = '82c098ef653139acc627f27a8a03d328';
const HEADERS = {
  Authorization: `KakaoAK ${REST_API_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * @typedef {object} SearchResult
 * @property {string}  id
 * @property {string}  primaryName   - 장소명 또는 도로명 주소
 * @property {string}  secondaryName - 카테고리 · 보조 주소
 * @property {string}  fullAddress   - 즐겨찾기 저장 등에 사용할 전체 주소
 * @property {number}  lat
 * @property {number}  lng
 * @property {'keyword'|'address'} type
 */

export class SearchService {
  constructor() {
    this._debounceTimer = null;
    this._debounceMs = 350;
    this._currentController = null;
  }

  /**
   * 장소 검색 — 키워드 검색과 주소 검색을 병렬 실행 후 병합
   * @param {string} query
   * @returns {Promise<SearchResult[]>}
   */
  async search(query) {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 1) return [];

    // 이전 요청 취소
    this._currentController?.abort();
    this._currentController = new AbortController();
    const signal = this._currentController.signal;

    const [keywordResult, addressResult] = await Promise.allSettled([
      this._keywordSearch(trimmed, signal),
      this._addressSearch(trimmed, signal),
    ]);

    if (signal.aborted) return [];

    const keyword = keywordResult.status === 'fulfilled' ? keywordResult.value : [];
    const address = addressResult.status === 'fulfilled' ? addressResult.value : [];

    if (keywordResult.status === 'rejected') {
      console.warn('[SearchService] 키워드 검색 실패:', keywordResult.reason);
    }
    if (addressResult.status === 'rejected') {
      console.warn('[SearchService] 주소 검색 실패:', addressResult.reason);
    }

    // 주소 검색 결과 우선 배치, 키워드 결과에서 중복 제거 후 병합
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
    const params = new URLSearchParams({ x: lng, y: lat, input_coord: 'WGS84' });
    try {
      const res = await fetch(`${KAKAO_LOCAL}/geo/coord2address.json?${params}`, {
        headers: HEADERS,
      });
      if (!res.ok) {
        console.warn('[SearchService] 역지오코딩 실패:', res.status, await res.text());
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
      const data = await res.json();
      const doc = data.documents?.[0];
      if (doc?.road_address?.address_name) return doc.road_address.address_name;
      if (doc?.address?.address_name) return doc.address.address_name;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[SearchService] 역지오코딩 오류:', err);
      }
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
   * 카카오 키워드 장소 검색
   * 아파트명, 역명, 건물명, 상호 등 POI 검색에 적합
   */
  async _keywordSearch(query, signal) {
    const params = new URLSearchParams({ query, size: 7 });
    const res = await fetch(`${KAKAO_LOCAL}/search/keyword.json?${params}`, {
      headers: HEADERS,
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();
    return (data.documents || []).map((doc) => ({
      id: `kw_${doc.id}`,
      primaryName: doc.place_name,
      secondaryName: this._buildSecondary(doc),
      fullAddress: doc.road_address_name || doc.address_name || doc.place_name,
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
      type: 'keyword',
    }));
  }

  /**
   * 카카오 주소 검색
   * 도로명/지번 주소 직접 입력 검색에 적합
   */
  async _addressSearch(query, signal) {
    const params = new URLSearchParams({ query, size: 5 });
    const res = await fetch(`${KAKAO_LOCAL}/search/address.json?${params}`, {
      headers: HEADERS,
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();
    return (data.documents || []).map((doc) => {
      const roadName = doc.road_address?.address_name || '';
      const jibunName = doc.address?.address_name || '';
      return {
        id: `addr_${doc.address_name}`,
        primaryName: roadName || jibunName,
        secondaryName: roadName && jibunName && roadName !== jibunName ? jibunName : '',
        fullAddress: roadName || jibunName,
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
        type: 'address',
      };
    });
  }

  /**
   * 키워드 검색 결과의 부가 정보 텍스트 조합
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
