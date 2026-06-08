// ===================================================
// searchService.js - 카카오 로컬 API 지오코딩 서비스
//
// 카카오 로컬 REST API를 사용하여 한국어 주소 및 장소명을 검색합니다.
// - 키워드 검색: 건물명, 상호명, 아파트명 등 POI 검색
// - 주소 검색: 도로명 주소, 지번 주소 검색
// 두 검색을 병렬로 실행하여 결과를 병합합니다.
//
// 추후 다른 지오코딩 API로 교체 시 이 파일만 수정하면 됩니다.
// ===================================================

const KAKAO_BASE = 'https://dapi.kakao.com/v2/local';
const API_KEY = '82c098ef653139acc627f27a8a03d328';

const HEADERS = { Authorization: `KakaoAK ${API_KEY}` };

/**
 * @typedef {object} SearchResult
 * @property {string}  id
 * @property {string}  primaryName   - 표시용 주 이름 (장소명 or 주소)
 * @property {string}  secondaryName - 보조 정보 (주소, 카테고리 등)
 * @property {string}  fullAddress   - 전체 주소 문자열
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
   * 키워드 또는 주소로 장소 검색
   * 키워드 검색과 주소 검색을 병렬 실행 후 병합합니다.
   * @param {string} query
   * @returns {Promise<SearchResult[]>}
   */
  async search(query) {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 1) return [];

    // 두 검색을 병렬 실행 — 어느 한쪽이 실패해도 나머지 결과를 사용
    const [keywordResult, addressResult] = await Promise.allSettled([
      this._keywordSearch(trimmed),
      this._addressSearch(trimmed),
    ]);

    const keyword = keywordResult.status === 'fulfilled' ? keywordResult.value : [];
    const address = addressResult.status === 'fulfilled' ? addressResult.value : [];

    // 병합: 주소 결과 우선 배치, 키워드 결과에서 중복 좌표 제거
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
      const res = await fetch(`${KAKAO_BASE}/geo/coord2address.json?${params}`, {
        headers: HEADERS,
      });
      const data = await res.json();
      const doc = data.documents?.[0];
      if (doc?.road_address?.address_name) return doc.road_address.address_name;
      if (doc?.address?.address_name) return doc.address.address_name;
    } catch {}
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
   * 카카오 키워드 검색 — 장소명, 건물명, 아파트명, 상호 등
   * @param {string} query
   * @returns {Promise<SearchResult[]>}
   */
  async _keywordSearch(query) {
    const params = new URLSearchParams({ query, size: 7 });
    const res = await fetch(`${KAKAO_BASE}/search/keyword.json?${params}`, {
      headers: HEADERS,
    });
    if (!res.ok) return [];

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
   * 카카오 주소 검색 — 도로명/지번 주소 직접 검색
   * @param {string} query
   * @returns {Promise<SearchResult[]>}
   */
  async _addressSearch(query) {
    const params = new URLSearchParams({ query, size: 5 });
    const res = await fetch(`${KAKAO_BASE}/search/address.json?${params}`, {
      headers: HEADERS,
    });
    if (!res.ok) return [];

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
   * 카카오 키워드 결과에서 부가 정보 문자열 조합
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
