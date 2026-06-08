// ===================================================
// favoritesService.js - 즐겨찾기 목적지 관리
//
// localStorage 기반으로 즐겨찾기 목적지를 저장·조회·삭제합니다.
// 각 항목에 사용자 정의 별명을 부여할 수 있습니다.
// ===================================================

const STORAGE_KEY = 'destination-alert-favorites';
const MAX_FAVORITES = 50;

/**
 * @typedef {object} Favorite
 * @property {string} id - 고유 ID (타임스탬프 기반)
 * @property {string} nickname - 사용자 지정 별명
 * @property {string} address - 전체 주소 문자열
 * @property {string} displayName - 검색 결과 1차 이름
 * @property {number} lat - 위도
 * @property {number} lng - 경도
 * @property {string} createdAt - ISO 8601 생성 시각
 */

export class FavoritesService {
  constructor() {
    this._items = this._load();
    this._listeners = [];
  }

  // ── 조회 ─────────────────────────────────────────

  /** 전체 즐겨찾기 목록 반환 (최신순) */
  getAll() {
    return [...this._items];
  }

  /** ID로 단일 항목 조회 */
  getById(id) {
    return this._items.find((f) => f.id === id) || null;
  }

  /** 이미 즐겨찾기에 등록된 좌표인지 확인 (30m 이내) */
  isDuplicate(lat, lng) {
    return this._items.some((f) => {
      const dlat = f.lat - lat;
      const dlng = f.lng - lng;
      return Math.sqrt(dlat * dlat + dlng * dlng) < 0.0003; // 약 30m
    });
  }

  // ── 추가 ─────────────────────────────────────────

  /**
   * 즐겨찾기 추가
   * @param {{ lat: number, lng: number, displayName?: string, address?: string }} destination
   * @param {string} nickname - 사용자 지정 별명 (빈 문자열이면 displayName 사용)
   * @returns {Favorite}
   */
  add(destination, nickname = '') {
    if (this._items.length >= MAX_FAVORITES) {
      // 가장 오래된 항목 제거
      this._items.pop();
    }

    const resolvedNickname = nickname.trim() || destination.displayName || '저장된 장소';

    /** @type {Favorite} */
    const item = {
      id: `fav_${Date.now()}`,
      nickname: resolvedNickname,
      address: destination.address || destination.displayName || '',
      displayName: destination.displayName || '',
      lat: destination.lat,
      lng: destination.lng,
      createdAt: new Date().toISOString(),
    };

    this._items.unshift(item);
    this._save();
    this._notify();
    return item;
  }

  // ── 수정 ─────────────────────────────────────────

  /**
   * 별명 변경
   * @param {string} id
   * @param {string} nickname
   */
  updateNickname(id, nickname) {
    const item = this._items.find((f) => f.id === id);
    if (!item) return;
    item.nickname = nickname.trim() || item.displayName || '저장된 장소';
    this._save();
    this._notify();
  }

  // ── 삭제 ─────────────────────────────────────────

  /**
   * 즐겨찾기 삭제
   * @param {string} id
   */
  remove(id) {
    const before = this._items.length;
    this._items = this._items.filter((f) => f.id !== id);
    if (this._items.length !== before) {
      this._save();
      this._notify();
    }
  }

  // ── 변경 구독 ────────────────────────────────────

  /**
   * 데이터 변경 시 호출될 리스너 등록
   * @param {Function} fn
   */
  onChange(fn) {
    this._listeners.push(fn);
  }

  // ── Private ─────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._items));
    } catch (e) {
      console.warn('[FavoritesService] localStorage write failed:', e);
    }
  }

  _notify() {
    this._listeners.forEach((fn) => fn(this._items));
  }
}

export const favoritesService = new FavoritesService();
