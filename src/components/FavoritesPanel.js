// ===================================================
// FavoritesPanel.js - 즐겨찾기 패널 컴포넌트
//
// 즐겨찾기 목록 표시, 별명 편집, 삭제, 목적지 설정을 담당합니다.
// ===================================================

import { favoritesService } from '../services/favoritesService.js';

export class FavoritesPanel {
  constructor() {
    this._panel = document.getElementById('favorites-panel');
    this._list = document.getElementById('favorites-list');
    this._emptyMsg = document.getElementById('favorites-empty');
    this._btnOpen = document.getElementById('btn-open-favorites');
    this._btnClose = document.getElementById('btn-close-favorites');

    // 저장 모달
    this._modal = document.getElementById('save-favorite-modal');
    this._nicknameInput = document.getElementById('save-favorite-nickname');
    this._addressPreview = document.getElementById('save-favorite-address');
    this._btnConfirm = document.getElementById('btn-save-favorite-confirm');
    this._btnCancel = document.getElementById('btn-save-favorite-cancel');

    // 현재 저장 대상 목적지 임시 저장
    this._pendingDestination = null;

    // 콜백
    this._onSelectCallback = null;

    this._bindEvents();
    this._render(favoritesService.getAll());

    // 데이터 변경 자동 반영
    favoritesService.onChange((items) => this._render(items));
  }

  // ── 공개 API ─────────────────────────────────────

  /**
   * 즐겨찾기 항목 선택 시 콜백
   * @param {Function} fn - (favorite) => void
   */
  onSelect(fn) {
    this._onSelectCallback = fn;
  }

  /**
   * 즐겨찾기 저장 모달 열기
   * @param {{ lat, lng, displayName, address }} destination
   */
  openSaveModal(destination) {
    this._pendingDestination = destination;
    this._nicknameInput.value = destination.displayName || '';
    this._addressPreview.textContent = destination.address
      ? destination.address.split(',').slice(0, 3).join(',')
      : `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`;

    this._modal.classList.remove('hidden');
    // 입력창 포커스 (약간 지연)
    setTimeout(() => {
      this._nicknameInput.select();
      this._nicknameInput.focus();
    }, 100);
  }

  /** 패널 열기 */
  open() {
    this._panel.classList.remove('hidden');
    this._panel.classList.add('visible');
  }

  /** 패널 닫기 */
  close() {
    this._panel.classList.remove('visible');
    setTimeout(() => this._panel.classList.add('hidden'), 300);
  }

  // ── 이벤트 ───────────────────────────────────────

  _bindEvents() {
    // 즐겨찾기 버튼 (지도 위)
    this._btnOpen?.addEventListener('click', () => {
      this._panel?.classList.contains('visible') ? this.close() : this.open();
    });

    // 닫기 버튼
    this._btnClose?.addEventListener('click', () => this.close());

    // 패널 배경 클릭으로 닫기 (모바일)
    this._panel?.addEventListener('click', (e) => {
      if (e.target === this._panel) this.close();
    });

    // 저장 확인
    this._btnConfirm?.addEventListener('click', () => this._confirmSave());

    // 저장 취소
    this._btnCancel?.addEventListener('click', () => this._closeModal());

    // 엔터로 저장
    this._nicknameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._confirmSave();
      if (e.key === 'Escape') this._closeModal();
    });
  }


  _confirmSave() {
    if (!this._pendingDestination) return;
    const nickname = this._nicknameInput.value.trim();
    favoritesService.add(this._pendingDestination, nickname);
    this._closeModal();
  }

  _closeModal() {
    this._modal.classList.add('hidden');
    this._pendingDestination = null;
    this._nicknameInput.value = '';
  }

  // ── 렌더링 ───────────────────────────────────────

  _render(items) {
    if (!this._list) return;
    this._list.innerHTML = '';

    if (items.length === 0) {
      this._emptyMsg?.classList.remove('hidden');
      return;
    }

    this._emptyMsg?.classList.add('hidden');

    items.forEach((fav) => {
      const el = this._createItem(fav);
      this._list.appendChild(el);
    });
  }


  _createItem(fav) {
    const el = document.createElement('div');
    el.className = 'favorite-item';
    el.dataset.id = fav.id;

    const dateStr = new Date(fav.createdAt).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });

    el.innerHTML = `
      <button class="fav-select-btn" data-id="${fav.id}" aria-label="${fav.nickname}으로 목적지 설정">
        <div class="fav-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"/>
          </svg>
        </div>
        <div class="fav-info">
          <div class="fav-nickname" data-id="${fav.id}">${this._escapeHtml(fav.nickname)}</div>
          <div class="fav-address">${this._escapeHtml(
            fav.address?.split(',').slice(0, 2).join(',') || ''
          )}</div>
        </div>
      </button>
      <div class="fav-actions">
        <button class="fav-edit-btn icon-btn" data-id="${fav.id}" title="별명 편집" aria-label="별명 편집">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="fav-delete-btn icon-btn" data-id="${fav.id}" title="삭제" aria-label="즐겨찾기 삭제">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
        <span class="fav-date">${dateStr}</span>
      </div>
    `;

    // 이름 클릭 → 목적지 설정
    el.querySelector('.fav-select-btn').addEventListener('click', () => {
      this._onSelectCallback?.(fav);
      this.close();
    });

    // 편집 버튼 → 인라인 편집
    el.querySelector('.fav-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this._startInlineEdit(el, fav);
    });

    // 삭제 버튼
    el.querySelector('.fav-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this._deleteWithConfirm(fav.id, fav.nickname);
    });

    return el;
  }

  _startInlineEdit(itemEl, fav) {
    const nicknameEl = itemEl.querySelector('.fav-nickname');
    const currentName = fav.nickname;

    const input = document.createElement('input');
    input.className = 'fav-inline-input';
    input.value = currentName;
    input.maxLength = 30;

    nicknameEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        favoritesService.updateNickname(fav.id, newName);
      } else {
        // 변경 없으면 원래 상태로
        const restored = document.createElement('div');
        restored.className = 'fav-nickname';
        restored.dataset.id = fav.id;
        restored.textContent = currentName;
        input.replaceWith(restored);
      }
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') {
        input.value = currentName;
        input.blur();
      }
    });
  }

  _deleteWithConfirm(id, nickname) {
    if (window.confirm(`"${nickname}"을(를) 즐겨찾기에서 삭제할까요?`)) {
      favoritesService.remove(id);
    }
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
