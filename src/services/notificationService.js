// ===================================================
// notificationService.js - 알림, 진동, 서비스 워커 관리
// ===================================================

/**
 * NotificationService 클래스
 * 웹 알림 API, 진동, 알림음, 서비스 워커를 통합 관리합니다.
 */
export class NotificationService {
  constructor() {
    this._swRegistration = null;
    this._audioContext = null;

    // 설정 상태
    this._soundEnabled = true;
    this._vibrationEnabled = true;
    this._pushEnabled = true;
  }

  // ── 서비스 워커 등록 ─────────────────────────────

  /**
   * 서비스 워커 등록
   * @returns {Promise<ServiceWorkerRegistration|null>}
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[NotificationService] Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      this._swRegistration = registration;

      // SW로부터 메시지 수신 (추적 중지 명령 등)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'STOP_TRACKING') {
          window.dispatchEvent(new CustomEvent('sw:stop-tracking'));
        }
      });

      console.log('[NotificationService] Service Worker registered:', registration.scope);
      return registration;
    } catch (err) {
      console.error('[NotificationService] SW registration failed:', err);
      return null;
    }
  }

  // ── 알림 권한 ────────────────────────────────────

  /**
   * 현재 알림 권한 상태 반환
   * @returns {'granted'|'denied'|'default'|'unsupported'}
   */
  getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  /**
   * 알림 권한 요청
   * @returns {Promise<'granted'|'denied'|'default'>}
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('[NotificationService] Notification API not supported');
      return 'unsupported';
    }

    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    const result = await Notification.requestPermission();
    return result;
  }

  // ── 도착 알림 전송 ───────────────────────────────

  /**
   * 도착 알림 전체 처리
   * @param {{ distance: number, destination: { lat: number, lng: number } }} payload
   */
  async sendArrivalAlert(payload) {
    const { distance, destination } = payload;

    // 1. 소리
    if (this._soundEnabled) {
      this._playAlertSound();
    }

    // 2. 진동
    if (this._vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([300, 100, 300, 100, 600]);
    }

    // 3. 푸시 알림
    if (this._pushEnabled) {
      await this._sendPushNotification(destination, distance);
    }
  }

  /**
   * 서비스 워커에 도착 메시지 전송 (백그라운드 알림 트리거)
   */
  async _sendPushNotification(destination, distance) {
    const permission = this.getPermissionStatus();

    if (permission !== 'granted') {
      console.warn('[NotificationService] Notification permission not granted');
      return;
    }

    // SW를 통한 알림 (백그라운드 지원)
    if (this._swRegistration) {
      const sw = this._swRegistration.active || this._swRegistration.waiting;
      if (sw) {
        sw.postMessage({
          type: 'ARRIVAL_ALERT',
          payload: { destination, distance },
        });
        return;
      }
    }

    // Fallback: 직접 Notification API 사용 (포그라운드)
    try {
      new Notification('🎯 목적지 도착!', {
        body: `목적지까지 ${Math.round(distance)}m 남았습니다. 곧 도착합니다!`,
        icon: '/icons/icon-192.png',
        tag: 'arrival-alert',
        renotify: true,
        requireInteraction: true,
      });
    } catch (err) {
      console.error('[NotificationService] Notification failed:', err);
    }
  }

  // ── 알림음 ───────────────────────────────────────

  /**
   * Web Audio API로 알림음 생성
   */
  _playAlertSound() {
    try {
      if (!this._audioContext) {
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = this._audioContext;
      const now = ctx.currentTime;

      // 3음표 알림 멜로디
      const notes = [
        { freq: 523.25, start: 0, duration: 0.2 },     // C5
        { freq: 659.25, start: 0.25, duration: 0.2 },   // E5
        { freq: 783.99, start: 0.5, duration: 0.4 },    // G5
      ];

      notes.forEach(({ freq, start, duration }) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now + start);

        gainNode.gain.setValueAtTime(0, now + start);
        gainNode.gain.linearRampToValueAtTime(0.4, now + start + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        oscillator.start(now + start);
        oscillator.stop(now + start + duration + 0.05);
      });
    } catch (err) {
      console.warn('[NotificationService] Audio playback failed:', err);
    }
  }

  // ── 설정 업데이트 ────────────────────────────────

  setSoundEnabled(enabled) { this._soundEnabled = enabled; }
  setVibrationEnabled(enabled) { this._vibrationEnabled = enabled; }
  setPushEnabled(enabled) { this._pushEnabled = enabled; }

  /**
   * 알림 테스트 (설정 패널에서 호출)
   */
  async testAlert() {
    await this.sendArrivalAlert({ distance: 50, destination: null });
  }
}

// 싱글톤 인스턴스
export const notificationService = new NotificationService();
