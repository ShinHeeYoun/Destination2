// ===================================================
// SettingsPanel.js - 환경 설정 패널 컴포넌트
// ===================================================

/**
 * SettingsPanel 컴포넌트
 * 알림 반경, 업데이트 주기, 알림 방식을 관리합니다.
 * 설정값은 localStorage에 영속화됩니다.
 */
export class SettingsPanel {
  constructor() {
    // 기본값
    this._defaults = {
      radius: 500,
      interval: 10000,
      sound: true,
      vibration: true,
      push: true,
    };

    // 현재 설정값
    this._settings = { ...this._defaults };

    // 콜백
    this._onRadiusChange = null;
    this._onIntervalChange = null;
    this._onSoundChange = null;
    this._onVibrationChange = null;
    this._onPushChange = null;

    // DOM 요소
    this._radiusChips = document.querySelectorAll('#radius-chips .chip');
    this._intervalChips = document.querySelectorAll('#interval-chips .chip');
    this._toggleSound = document.getElementById('toggle-sound');
    this._toggleVibration = document.getElementById('toggle-vibration');
    this._togglePush = document.getElementById('toggle-push');
    this._permissionStatus = document.getElementById('notification-permission-status');
    this._permissionText = document.getElementById('permission-text');
    this._btnRequestPermission = document.getElementById('btn-request-permission');

    this._loadSettings();
    this._bindEvents();
    this._applySettings();
  }

  // ── 콜백 등록 ────────────────────────────────────

  onRadiusChange(cb) { this._onRadiusChange = cb; }
  onIntervalChange(cb) { this._onIntervalChange = cb; }
  onSoundChange(cb) { this._onSoundChange = cb; }
  onVibrationChange(cb) { this._onVibrationChange = cb; }
  onPushChange(cb) { this._onPushChange = cb; }

  /**
   * 알림 권한 요청 버튼 콜백
   */
  onRequestPermission(cb) {
    this._btnRequestPermission.addEventListener('click', cb);
  }

  /**
   * 권한 상태 UI 업데이트
   */
  updatePermissionStatus(status) {
    this._permissionStatus.className = 'permission-card';

    switch (status) {
      case 'granted':
        this._permissionStatus.classList.add('granted');
        this._permissionText.textContent = '✅ 알림 권한이 허용되었습니다';
        this._btnRequestPermission.style.display = 'none';
        break;
      case 'denied':
        this._permissionStatus.classList.add('denied');
        this._permissionText.textContent = '❌ 알림 권한이 거부되었습니다. 브라우저 설정에서 변경하세요.';
        this._btnRequestPermission.style.display = 'none';
        break;
      case 'default':
        this._permissionText.textContent = '⚠️ 알림 권한이 필요합니다';
        this._btnRequestPermission.style.display = 'flex';
        break;
      case 'unsupported':
        this._permissionStatus.classList.add('denied');
        this._permissionText.textContent = '⚠️ 이 브라우저는 알림을 지원하지 않습니다';
        this._btnRequestPermission.style.display = 'none';
        break;
      default:
        this._permissionText.textContent = '알림 권한 확인중...';
    }
  }

  // ── Getters ──────────────────────────────────────

  get radius() { return this._settings.radius; }
  get interval() { return this._settings.interval; }
  get sound() { return this._settings.sound; }
  get vibration() { return this._settings.vibration; }
  get push() { return this._settings.push; }

  // ── Private ─────────────────────────────────────

  _loadSettings() {
    try {
      const saved = localStorage.getItem('destination-alert-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this._settings = { ...this._defaults, ...parsed };
      }
    } catch {
      this._settings = { ...this._defaults };
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem('destination-alert-settings', JSON.stringify(this._settings));
    } catch {
      // localStorage 사용 불가 시 무시
    }
  }

  _bindEvents() {
    // 반경 칩 선택
    this._radiusChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = parseInt(chip.dataset.value, 10);
        this._selectChip(this._radiusChips, chip);
        this._settings.radius = value;
        this._saveSettings();
        this._onRadiusChange?.(value);
      });
    });

    // 주기 칩 선택
    this._intervalChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = parseInt(chip.dataset.value, 10);
        this._selectChip(this._intervalChips, chip);
        this._settings.interval = value;
        this._saveSettings();
        this._onIntervalChange?.(value);
      });
    });

    // 토글 - 소리
    this._toggleSound.addEventListener('change', () => {
      this._settings.sound = this._toggleSound.checked;
      this._saveSettings();
      this._onSoundChange?.(this._settings.sound);
    });

    // 토글 - 진동
    this._toggleVibration.addEventListener('change', () => {
      this._settings.vibration = this._toggleVibration.checked;
      this._saveSettings();
      this._onVibrationChange?.(this._settings.vibration);
    });

    // 토글 - 푸시
    this._togglePush.addEventListener('change', () => {
      this._settings.push = this._togglePush.checked;
      this._saveSettings();
      this._onPushChange?.(this._settings.push);
    });
  }

  _applySettings() {
    // 저장된 반경 칩 활성화
    this._radiusChips.forEach((chip) => {
      chip.classList.toggle('active', parseInt(chip.dataset.value, 10) === this._settings.radius);
    });

    // 저장된 주기 칩 활성화
    this._intervalChips.forEach((chip) => {
      chip.classList.toggle('active', parseInt(chip.dataset.value, 10) === this._settings.interval);
    });

    // 토글 상태 복원
    this._toggleSound.checked = this._settings.sound;
    this._toggleVibration.checked = this._settings.vibration;
    this._togglePush.checked = this._settings.push;
  }

  _selectChip(chips, activeChip) {
    chips.forEach((c) => c.classList.remove('active'));
    activeChip.classList.add('active');
  }
}
