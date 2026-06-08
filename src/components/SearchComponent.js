// ===================================================
// SearchComponent.js - 주소 검색 UI 컴포넌트
//
// Nominatim 지오코딩을 통해 주소를 검색하고 목적지를 설정합니다.
// 입력 디바운싱, 로딩 상태, 결과 없음 처리를 포함합니다.
// ===================================================

import { searchService } from '../services/searchService.js';

export class SearchComponent {
  constructor() {
    this._container = document.getElementById('search-container');
    this._input = document.getElementById('search-input');
    this._clearBtn = document.getElementById('btn-search-clear');
    this._resultsEl = document.getElementById('search-results');
    this._loadingEl = document.getElementById('search-loading');

    this._onSelectCallback = null;
    this._isOpen = false;

    this._debouncedSearch = searchService.debounce((q) => this._doSearch(q));

    this._bindEvents();
  }

  /**
   * 검색 결과 선택 시 콜백 등록
   * @param {Function} fn - ({ lat, lng, displayName, address }) => void
   */
  onSelect(fn) {
    this._onSelectCallback = fn;
  }

  /**
   * 검색창 초기화 (외부에서 목적지가 지워졌을 때)
   */
  clear() {
    this._input.value = '';
    this._clearBtn.classList.add('hidden');
    this._closeResults();
  }

  /**
   * 검색창에 텍스트 설정 (즐겨찾기로 목적지 설정 시)
   */
  setValue(text) {
    this._input.value = text;
    this._clearBtn.classList.toggle('hidden', !text);
    this._closeResults();
  }

  // ── Private ─────────────────────────────────────

  _bindEvents() {
    if (!this._input) return;

    // 입력 이벤트 → 디바운스 검색
    this._input.addEventListener('input', (e) => {
      const q = e.target.value;
      if (this._clearBtn) this._clearBtn.classList.toggle('hidden', !q);
      if (!q.trim()) {
        this._closeResults();
        return;
      }
      this._showLoading();
      this._debouncedSearch(q);
    });

    // 엔터키로 즉시 검색
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = this._input.value.trim();
        if (q) this._doSearch(q);
      }
      if (e.key === 'Escape') {
        this._closeResults();
        this._input.blur();
      }
    });

    // X 버튼
    if (this._clearBtn) {
      this._clearBtn.addEventListener('click', () => {
        this.clear();
        this._input.focus();
      });
    }

    // 외부 클릭 시 결과 닫기
    document.addEventListener('click', (e) => {
      if (this._container && !this._container.contains(e.target)) {
        this._closeResults();
      }
    });

    // 포커스 시 기존 결과 다시 표시
    this._input.addEventListener('focus', () => {
      if (this._input.value.trim() && this._resultsEl && this._resultsEl.children.length > 0) {
        this._openResults();
      }
    });
  }


  async _doSearch(query) {
    this._showLoading();

    try {
      const results = await searchService.search(query);
      this._renderResults(results, query);
    } catch (err) {
      this._renderError();
    }
  }

  _renderResults(results, query) {
    this._resultsEl.innerHTML = '';

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>"<strong>${this._escapeHtml(query)}</strong>" 검색 결과가 없습니다.</p>
        <span>다른 키워드나 도로명 주소로 다시 시도해 보세요.</span>
      `;
      this._resultsEl.appendChild(empty);
    } else {
      results.forEach((result, idx) => {
        const item = this._createResultItem(result, idx);
        this._resultsEl.appendChild(item);
      });
    }

    this._openResults();
  }

  _createResultItem(result, idx) {
    const el = document.createElement('button');
    el.className = 'search-result-item';
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.dataset.idx = idx;

    el.innerHTML = `
      <div class="result-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div class="result-text">
        <div class="result-primary">${this._escapeHtml(result.primaryName)}</div>
        ${result.secondaryName
          ? `<div class="result-secondary">${this._escapeHtml(result.secondaryName)}</div>`
          : ''}
      </div>
    `;

    el.addEventListener('click', () => {
      this._selectResult(result);
    });

    return el;
  }

  _selectResult(result) {
    this._input.value = result.primaryName;
    this._clearBtn.classList.remove('hidden');
    this._closeResults();
    this._onSelectCallback?.({
      lat: result.lat,
      lng: result.lng,
      displayName: result.primaryName,
      address: result.fullAddress,
    });
  }

  _renderError() {
    this._resultsEl.innerHTML = `
      <div class="search-empty">
        <p>검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>
      </div>
    `;
    this._openResults();
  }

  _showLoading() {
    this._resultsEl.innerHTML = `
      <div class="search-loading-row">
        <div class="search-spinner"></div>
        <span>검색중...</span>
      </div>
    `;
    this._openResults();
  }

  _openResults() {
    this._resultsEl.classList.remove('hidden');
    this._isOpen = true;
  }

  _closeResults() {
    this._resultsEl.classList.add('hidden');
    this._isOpen = false;
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
