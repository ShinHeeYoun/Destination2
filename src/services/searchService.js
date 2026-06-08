// ===================================================
// searchService.js - Nominatim 지오코딩 서비스
//
// OpenStreetMap Nominatim API를 사용하여 주소를 검색합니다.
// 네이버/카카오 API 키 없이 동작하며, 한국어 주소 검색을 지원합니다.
// 추후 다른 지오코딩 API로 교체 시 이 파일만 수정하면 됩니다.
// ===================================================

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * 검색 결과 항목을 사람이 읽기 좋은 형태로 변환
 * @param {object} item - Nominatim 응답 항목
 * @returns {{ primaryName: string, secondaryName: string }}
 */
function formatResult(item) {
  const addr = item.address || {};

  // 1차 이름: 시설명 > 도로명 > 지역명
  const primary =
    addr.amenity ||
    addr.shop ||
    addr.tourism ||
    addr.leisure ||
    addr.building ||
    addr.office ||
    item.namedetails?.name ||
    addr.road ||
    addr.neighbourhood ||
    addr.suburb ||
    (item.display_name?.split(',')[0]?.trim()) ||
    '알 수 없는 장소';

  // 2차 이름: 시/군/구 + 도/시 조합
  const district = addr.neighbourhood || addr.suburb || addr.quarter || '';
  const city =
    addr.city ||
    addr.county ||
    addr.town ||
    addr.village ||
    addr.state_district ||
    '';
  const province = addr.province || addr.state || '';

  const parts = [district, city, province].filter(Boolean);
  const secondary = parts.slice(0, 2).join(' ') || item.display_name?.split(',').slice(1, 3).join(',').trim() || '';

  return { primaryName: primary, secondaryName: secondary };
}

/**
 * SearchService - 주소 검색 및 역지오코딩
 */
export class SearchService {
  constructor() {
    this._debounceTimer = null;
    this._debounceMs = 350;
    this._abortController = null;
  }

  /**
   * 키워드로 주소 검색
   * @param {string} query - 검색어 (한국어 주소, 건물명, 지역명 등)
   * @returns {Promise<SearchResult[]>}
   */
  async search(query) {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 2) return [];

    // 이전 요청 취소
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();

    const params = new URLSearchParams({
      q: trimmed,
      format: 'json',
      limit: 7,
      countrycodes: 'kr',
      addressdetails: 1,
      namedetails: 1,
      'accept-language': 'ko',
    });

    const url = `${NOMINATIM_BASE}/search?${params}`;

    try {
      const res = await fetch(url, {
        signal: this._abortController.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      return data.map((item) => {
        const { primaryName, secondaryName } = formatResult(item);
        return {
          id: item.place_id,
          primaryName,
          secondaryName,
          fullAddress: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          importance: item.importance,
        };
      });
    } catch (err) {
      if (err.name === 'AbortError') return [];
      console.error('[SearchService] Search failed:', err);
      throw err;
    }
  }

  /**
   * 좌표로 주소 역지오코딩
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<string>} 주소 문자열
   */
  async reverseGeocode(lat, lng) {
    const params = new URLSearchParams({
      lat,
      lon: lng,
      format: 'json',
      addressdetails: 1,
      'accept-language': 'ko',
    });

    try {
      const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      const { primaryName, secondaryName } = formatResult(data);
      return secondaryName ? `${primaryName}, ${secondaryName}` : primaryName;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  /**
   * 디바운스 래퍼 - 연속 입력 시 마지막 입력만 실행
   * @param {Function} fn
   * @returns {Function}
   */
  debounce(fn) {
    return (...args) => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => fn(...args), this._debounceMs);
    };
  }
}

export const searchService = new SearchService();
