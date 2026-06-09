// ===================================================
// Dashboard.js - 거리 및 상태 표시 컴포넌트
// ===================================================

import { formatDistance } from '../services/locationService.js';

/**
 * Dashboard 컴포넌트
 * 실시간 거리, 추적 상태, GPS 정확도를 표시합니다.
 */
export class Dashboard {
  constructor() {
    // DOM 요소 참조
    this._statusDot = document.getElementById('status-dot');
    this._statusText = document.getElementById('status-text');
    this._accuracyText = document.getElementById('accuracy-text');
    this._distanceValue = document.getElementById('distance-value');
    this._distanceUnit = document.getElementById('distance-unit');
    this._distanceBar = document.getElementById('distance-bar');
    this._destinationName = document.getElementById('destination-name');
    this._alertRadiusDisplay = document.getElementById('alert-radius-display');
    this._btnStartStop = document.getElementById('btn-start-stop');
    this._btnIconPlay = document.getElementById('btn-icon-play');
    this._btnIconStop = document.getElementById('btn-icon-stop');
    this._btnText = document.getElementById('btn-text');
    this._btnSaveFav = document.getElementById('btn-save-favorite');

    // 콜백
    this._onStartStop = null;
    this._onSaveFavorite = null;

    this._isTracking = false;
    this._hasDestination = false;

    this._bindEvents();
  }

  _bindEvents() {
    this._btnStartStop.addEventListener('click', () => {
      this._onStartStop?.();
    });
    if (this._btnSaveFav) {
      this._btnSaveFav.addEventListener('click', () => {
        this._onSaveFavorite?.();
      });
    }
  }

  /**
   * 시작/정지 토글 콜백
   */
  onStartStop(callback) {
    this._onStartStop = callback;
  }

  /**
   * 즐겨찾기 저장 버튼 콜백
   */
  onSaveFavorite(callback) {
    this._onSaveFavorite = callback;
  }


  /**
   * 상태 업데이트
   * @param {'idle'|'tracking'|'arrived'|'error'} status
   * @param {string} message
   */
  setStatus(status, message) {
    // 도트 클래스 초기화
    this._statusDot.className = `status-dot ${status}`;
    this._statusText.textContent = message;
  }

  /**
   * GPS 정확도 표시
   * @param {number|null} accuracy - 미터 단위
   */
  setAccuracy(accuracy) {
    if (accuracy === null) {
      this._accuracyText.textContent = 'GPS 대기중';
      return;
    }
    const level = accuracy < 20 ? '●' : accuracy < 50 ? '◑' : '○';
    this._accuracyText.textContent = `${level} 정확도 ±${Math.round(accuracy)}m`;
  }

  /**
   * 거리 업데이트
   * @param {number|null} meters - null이면 '--' 표시
   * @param {number} percent - 거리 바 퍼센트 (0~100)
   */
  setDistance(meters, percent = 0) {
    if (meters === null) {
      this._distanceValue.textContent = '--';
      this._distanceUnit.textContent = 'm';
      this._distanceBar.style.width = '0%';
      return;
    }

    const { value, unit } = formatDistance(meters);
    this._distanceValue.textContent = value;
    this._distanceUnit.textContent = unit;
    this._distanceBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;

    // 가까워질수록 색상 변경
    if (meters < 200) {
      this._distanceBar.style.background = 'linear-gradient(90deg, #10d48e, #00ff88)';
      this._distanceValue.style.background = 'linear-gradient(135deg, #10d48e, #00ff88)';
    } else if (meters < 500) {
      this._distanceBar.style.background = 'linear-gradient(90deg, #f59e0b, #10d48e)';
      this._distanceValue.style.background = 'linear-gradient(135deg, #f59e0b, #10d48e)';
    } else {
      this._distanceBar.style.background = 'linear-gradient(90deg, var(--color-primary), var(--color-success))';
      this._distanceValue.style.background = 'linear-gradient(135deg, var(--color-primary-light), var(--color-info))';
    }
    this._distanceValue.style.webkitBackgroundClip = 'text';
    this._distanceValue.style.webkitTextFillColor = 'transparent';
    this._distanceValue.style.backgroundClip = 'text';
  }

  /**
   * 목적지 좌표 표시
   * @param {{ lat: number, lng: number, displayName?: string }|null} destination
   * @param {number} radius - 알림 반경 (미터)
   */
  setDestination(destination, radius) {
    this._hasDestination = !!destination;

    if (destination) {
      if (this._destinationName) {
        this._destinationName.textContent =
          destination.displayName || `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`;
        this._destinationName.classList.remove('placeholder');
      }
      if (this._alertRadiusDisplay) {
        this._alertRadiusDisplay.textContent =
          radius >= 1000 ? `반경 ${radius / 1000}km` : `반경 ${radius}m`;
      }
      this._btnSaveFav?.classList.remove('hidden');
    } else {
      if (this._destinationName) {
        this._destinationName.textContent = '지도에서 선택하거나 검색하세요';
        this._destinationName.classList.add('placeholder');
      }
      if (this._alertRadiusDisplay) this._alertRadiusDisplay.textContent = '';
      this._btnSaveFav?.classList.add('hidden');
      this._btnSaveFav?.classList.remove('saved');
    }

    this._updateStartButton();
  }

  /**
   * 즐겨찾기 저장 버튼 상태 업데이트
   */
  setSaveFavoriteState(isSaved) {
    if (isSaved) {
      this._btnSaveFav?.classList.add('saved');
    } else {
      this._btnSaveFav?.classList.remove('saved');
    }
  }


  /**
   * 추적 상태에 따른 버튼 업데이트
   * @param {boolean} isTracking
   */
  setTracking(isTracking) {
    this._isTracking = isTracking;
    this._updateStartButton();
  }

  // ── Private ─────────────────────────────────────

  _updateStartButton() {
    if (!this._hasDestination) {
      this._btnStartStop.disabled = true;
      this._btnText.textContent = '목적지를 먼저 설정하세요';
      this._btnStartStop.classList.remove('stop-mode');
      this._btnIconPlay.style.display = '';
      this._btnIconStop.style.display = 'none';
      return;
    }

    this._btnStartStop.disabled = false;

    if (this._isTracking) {
      this._btnText.textContent = '추적 중지';
      this._btnStartStop.classList.add('stop-mode');
      this._btnIconPlay.style.display = 'none';
      this._btnIconStop.style.display = '';
    } else {
      this._btnText.textContent = '추적 시작';
      this._btnStartStop.classList.remove('stop-mode');
      this._btnIconPlay.style.display = '';
      this._btnIconStop.style.display = 'none';
    }
  }
}
