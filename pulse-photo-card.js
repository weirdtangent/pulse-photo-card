class PulsePhotoCard extends HTMLElement {
  constructor() {
    super();
    this._frontLayer = 'a';
    this._currentRaw = undefined;
    this._currentUrl = undefined;
    this._pendingLoadId = 0;
    this._clockInterval = null;
    this._timeEl = null;
    this._dateEl = null;
    this._nowPlayingEl = null;
    this._nowPlayingLabelEl = null;
    this._nowPlayingTextEl = null;
    this._nowPlayingLastText = '';
    this._resolvedNowPlayingEntity = null;
    this._legacyOverlayEl = null;
    this._remoteOverlayEl = null;
    this._remoteOverlayFrame = null;
    this._overlayStatusEl = null;
    this._overlayUrl = null;
    this._overlayEnabled = false;
    this._overlayRefreshEntity = null;
    this._overlayPollMs = 120000;
    this._overlayPollTimer = null;
    this._overlayLastTrigger = null;
    this._overlayLastNowPlayingTrigger = null;
    this._overlayActive = false;
    this._overlayLastFetch = 0;
  }

  setConfig(config) {
    if (!config?.entity) {
      throw new Error('Set "entity" in pulse-photo-card config');
    }

    this._config = {
      fade_ms: 1000,
      now_playing_entity: null,
      now_playing_label: 'Now Playing',
      overlay_enabled: undefined,
      overlay_url: undefined,
      overlay_refresh_entity: undefined,
      overlay_poll_seconds: 120,
      show_overlay_status: true,
      ...config,
    };

    if (typeof this._config.now_playing_entity === 'string') {
      const trimmed = this._config.now_playing_entity.trim();
      this._config.now_playing_entity = trimmed.length > 0 ? trimmed : null;
    }

    if (!this._config.now_playing_label) {
      this._config.now_playing_label = 'Now Playing';
    }

    this._resolvedNowPlayingEntity = this._resolveNowPlayingEntity();
    const showNowPlaying = Boolean(this._resolvedNowPlayingEntity);
    this._configureOverlayEndpoint();

    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    const nowPlayingMarkup = showNowPlaying
      ? `
              <div class="now-playing">
                <div class="now-playing__label"></div>
                <div class="now-playing__text"></div>
              </div>
            `
      : '';

    const overlayStatusMarkup = this._config.show_overlay_status
      ? `
        <div class="overlay-status">
          <span class="overlay-status__emoji" aria-hidden="true">🕒</span>
          <span class="overlay-status__text">Legacy overlay</span>
        </div>
      `
      : '';

    const remoteOverlayMarkup = this._overlayEnabled
      ? `
            <div class="overlay overlay--remote hidden">
              <iframe class="overlay__frame" title="Pulse overlay" sandbox="allow-scripts allow-forms allow-same-origin" allowtransparency="true"></iframe>
            </div>
          `
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host,
        ha-card {
          height: 100vh;
          width: 100vw;
          margin: 0;
          background: transparent;
        }

        ha-card {
          position: relative;
          overflow: hidden;
          cursor: default;
          font-family: "Inter", "Segoe UI", "Helvetica Neue", sans-serif, "Noto Color Emoji";
        }

        .frame {
          position: absolute;
          inset: 0;
          background: #000;
        }

        img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #000;
          opacity: 0;
          transition: opacity var(--fade-ms, 500ms) ease-in-out;
          z-index: 1;
        }

        img.visible {
          opacity: 1;
        }

        .overlay {
          position: absolute;
          inset: 0;
        }

        .overlay-status {
          position: absolute;
          top: 18px;
          left: 18px;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.95rem;
          font-weight: 500;
          padding: 0.35rem 0.65rem;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.45);
          color: #fff;
          pointer-events: none;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          z-index: 3;
        }

        .overlay-status.hidden {
          display: none;
        }

        .overlay-status__emoji {
          font-size: 1.1rem;
        }

        .overlay--legacy {
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          pointer-events: none;
          padding: 48px;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0.35) 65%,
            rgba(0, 0, 0, 0.75) 100%
          );
          opacity: 1;
          transition: opacity 180ms ease;
          z-index: 2;
        }

        .overlay--legacy.hidden {
          display: none;
        }

        .overlay--remote {
          pointer-events: auto;
          z-index: 2;
        }

        .overlay--remote.hidden {
          display: none;
          pointer-events: none;
        }

        .overlay__frame {
          width: 100%;
          height: 100%;
          border: none;
          background: transparent;
        }

        /* Hide Home Assistant's built-in media player notification overlay */
        ha-media-player-notification,
        .media-player-notification,
        [data-media-player-notification],
        .ha-media-player-notification {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        .overlay__frame::-webkit-scrollbar {
          display: none;
        }

        .overlay__content {
          display: flex;
          flex-direction: row;
          align-items: flex-end;
          justify-content: space-between;
          gap: clamp(18px, 4vw, 32px);
          flex-wrap: wrap;
          width: 100%;
        }

        .clock {
          text-shadow: 0 4px 12px rgba(0, 0, 0, 0.9);
          color: #fff;
          font-family: "Noto Sans", Verdana, "DejaVu Sans", sans-serif;
          line-height: 1.1;
          flex: 0 1 auto;
        }

        .clock__time {
          font-size: clamp(3.5rem, 8vw, 6.5rem);
          font-weight: 300;
          letter-spacing: -0.03em;
        }

        .clock__date {
          font-size: clamp(1.3rem, 3vw, 2.2rem);
          font-weight: 400;
          opacity: 0.85;
        }

        .now-playing {
          pointer-events: none;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 180ms ease, transform 180ms ease;
          text-align: right;
          flex: 1 1 50%;
          max-width: min(540px, 70vw);
        }

        .now-playing.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .now-playing__label {
          font-size: clamp(0.95rem, 2vw, 1.4rem);
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 0.35em;
          text-align: right;
        }

        .now-playing__text {
          font-size: clamp(1.1rem, 2.6vw, 2rem);
          font-weight: 400;
          color: #fff;
          line-height: 1.3;
          text-align: right;
        }
      </style>

      <ha-card>
        <div class="frame">
          <img class="layer layer-a visible" />
          <img class="layer layer-b" />
        </div>
        ${overlayStatusMarkup}
        ${remoteOverlayMarkup}
        <div class="overlay overlay--legacy">
          <div class="overlay__content">
            <div class="clock">
              <div class="clock__time">--:--</div>
              <div class="clock__date">Loading…</div>
            </div>
            ${nowPlayingMarkup}
          </div>
        </div>
      </ha-card>
    `;

    this.style.setProperty('--fade-ms', `${this._config.fade_ms}ms`);
    this._card = this.shadowRoot.querySelector('ha-card');
    this._layers = {
      a: this.shadowRoot.querySelector('.layer-a'),
      b: this.shadowRoot.querySelector('.layer-b'),
    };
    this._legacyOverlayEl = this.shadowRoot.querySelector('.overlay--legacy');
    this._remoteOverlayEl = this.shadowRoot.querySelector('.overlay--remote');
    this._remoteOverlayFrame = this.shadowRoot.querySelector('.overlay__frame');
    this._overlayStatusEl = this.shadowRoot.querySelector('.overlay-status');
    this._timeEl = this.shadowRoot.querySelector('.clock__time');
    this._dateEl = this.shadowRoot.querySelector('.clock__date');
    this._nowPlayingEl = this.shadowRoot.querySelector('.now-playing');
    this._nowPlayingLabelEl = this.shadowRoot.querySelector('.now-playing__label');
    this._nowPlayingTextEl = this.shadowRoot.querySelector('.now-playing__text');
    if (this._nowPlayingLabelEl) {
      this._nowPlayingLabelEl.textContent = this._config.now_playing_label || 'Now Playing';
    }

    this._startClock();
    this._updateNowPlaying();
    this._ensureOverlayPolling();
    this._updateOverlayStatus();

    // Inject global CSS to hide Home Assistant's built-in media player notification overlay
    // This appears before dashboards load and is separate from our card's Now Playing badge
    if (!document.getElementById('pulse-photo-card-hide-ha-media-notification')) {
      const style = document.createElement('style');
      style.id = 'pulse-photo-card-hide-ha-media-notification';
      style.textContent = `
        ha-media-player-notification,
        .media-player-notification,
        [data-media-player-notification],
        .ha-media-player-notification,
        ha-notification-drawer ha-media-player-notification {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      this._logToHA('info', 'Injected global CSS to hide HA media player notification overlay');
    }

    // Log initial state
    const host = this._extractPulseHostFromQuery() || 'none';
    const legacyFound = !!this._legacyOverlayEl;
    const remoteFound = !!this._remoteOverlayEl;
    this._logToHA('info', `card initialized: host=${host}, legacyOverlay=${legacyFound}, remoteOverlay=${remoteFound}, overlayEnabled=${this._overlayEnabled}`);

    this._handleOverlayRefreshTrigger('config');
    if (!window.__pulsePhotoCardVersionLogged) {
      try {
        const version = this._config?.version || 'dev';
        console.info(`pulse-photo-card: runtime version ${version} loaded`);
      } catch (versionLogErr) {
        console.warn('pulse-photo-card: failed to log version', versionLogErr);
      }
      window.__pulsePhotoCardVersionLogged = true;
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._startClock();
    if (!this._config) {
      return;
    }

    const entity = hass.states?.[this._config.entity];
    if (entity) {
      const newRaw = entity.state;
      if (newRaw && newRaw !== 'unknown' && newRaw !== 'unavailable') {
        if (newRaw !== this._currentRaw || !this._currentUrl) {
          this._currentRaw = newRaw;
          this._loadNewImage(newRaw);
        }
      }
    }

    this._updateNowPlaying();
    this._handleOverlayRefreshTrigger('hass');
  }

  async _loadNewImage(rawPath) {
    const loadId = ++this._pendingLoadId;
    const resolvedUrl = await this._resolveUrl(rawPath);

    if (!resolvedUrl) {
      this._logToHA('warning', `photo URL resolution failed for: ${rawPath}`);
      return;
    }
    if (loadId !== this._pendingLoadId) {
      this._logToHA('debug', `photo load superseded (loadId ${loadId} vs ${this._pendingLoadId})`);
      return;
    }
    if (resolvedUrl === this._currentUrl) {
      return;
    }

    this._logToHA('debug', `loading photo: ${resolvedUrl.substring(0, 100)}...`);
    this._swapImage(resolvedUrl);
  }

  async _resolveUrl(rawPath) {
    if (!rawPath) {
      return null;
    }

    if (rawPath.startsWith('media-source://')) {
      try {
        const resolved = await this._hass.callWS({
          type: 'media_source/resolve_media',
          media_content_id: rawPath,
        });

        if (resolved?.url) {
          return this._hass.hassUrl(resolved.url);
        }
      } catch (err) {
        console.error('pulse-photo-card: failed to resolve media source', err);
        return null;
      }

      return null;
    }

    if (rawPath.startsWith('/')) {
      return this._hass.hassUrl(rawPath);
    }

    if (/^https?:\/\//.test(rawPath)) {
      return rawPath;
    }

    return null;
  }

  _swapImage(url) {
    const current = this._layers[this._frontLayer];
    const nextLayerKey = this._frontLayer === 'a' ? 'b' : 'a';
    const next = this._layers[nextLayerKey];

    next.onload = () => {
      current.classList.remove('visible');
      next.classList.add('visible');
      next.onload = null;
      next.onerror = null;
      this._frontLayer = nextLayerKey;
      this._currentUrl = url;
      this._logToHA('debug', `photo loaded successfully: ${url.substring(0, 80)}...`);
    };

    next.onerror = (err) => {
      console.error('pulse-photo-card: failed to load image', err);
      this._logToHA('error', `photo load failed: ${err.message || String(err)} - URL: ${url}`);
      next.onerror = null;
      next.onload = null;
    };

    // Force reflow so browser treats same URL as new request
    next.src = '';
    next.src = url;
  }

  _updateNowPlaying() {
    if (!this._nowPlayingEl) {
      return;
    }

    // Don't show legacy Now Playing badge if remote overlay is active
    const remoteOverlayActive = this._overlayEnabled && this._overlayActive &&
      this._remoteOverlayEl && !this._remoteOverlayEl.classList.contains('hidden');
    if (remoteOverlayActive) {
      this._nowPlayingEl.classList.remove('visible');
      return;
    }

    const targetEntity = this._resolvedNowPlayingEntity;
    if (!targetEntity) {
      this._nowPlayingEl.classList.remove('visible');
      if (this._nowPlayingTextEl) {
        this._nowPlayingTextEl.textContent = '';
      }
      return;
    }

    const entity = this._hass?.states?.[targetEntity];
    const text = this._formatNowPlaying(entity);

    if (text) {
      if (this._nowPlayingTextEl && text !== this._nowPlayingLastText) {
        this._nowPlayingTextEl.textContent = text;
        this._nowPlayingLastText = text;
      }
      this._nowPlayingEl.classList.add('visible');
    } else {
      if (this._nowPlayingTextEl && this._nowPlayingLastText) {
        this._nowPlayingTextEl.textContent = '';
      }
      this._nowPlayingLastText = '';
      this._nowPlayingEl.classList.remove('visible');
    }
  }

  _formatNowPlaying(entity) {
    if (!entity) {
      return '';
    }

    const rawState = `${entity.state ?? ''}`;
    const normalizedState = rawState.toLowerCase();
    const attrs = entity.attributes || {};
    const entityId = entity.entity_id || '';
    const normalizeText = (value) => {
      if (value == null) {
        return '';
      }
      if (typeof value === 'string') {
        return value.trim();
      }
      return String(value).trim();
    };

    if (entityId.startsWith('sensor.')) {
      const cleanState = normalizeText(rawState);
      if (!cleanState || cleanState === 'unknown' || cleanState === 'unavailable') {
        return '';
      }
      return cleanState;
    }

    const activeStates = new Set(['playing', 'on', 'buffering', 'paused']);
    if (activeStates.size > 0 && !activeStates.has(normalizedState)) {
      return '';
    }

    const title =
      normalizeText(attrs.media_title) ||
      normalizeText(attrs.media_episode_title) ||
      normalizeText(attrs.media_album_name) ||
      normalizeText(attrs.media_content_id);

    const artist =
      normalizeText(attrs.media_artist) ||
      normalizeText(attrs.media_album_artist) ||
      normalizeText(attrs.media_series_title) ||
      normalizeText(attrs.app_name);

    if (title && artist) {
      return `${artist} — ${title}`;
    }

    return title || artist || '';
  }

  getCardSize() {
    return 1;
  }

  disconnectedCallback() {
    if (this._clockInterval) {
      clearInterval(this._clockInterval);
      this._clockInterval = null;
    }
    if (this._overlayPollTimer) {
      clearInterval(this._overlayPollTimer);
      this._overlayPollTimer = null;
    }
    this._updateOverlayStatus();
  }

  _startClock() {
    if (!this._timeEl || !this._dateEl || this._clockInterval || !this.isConnected) {
      return;
    }

    this._updateClock();
    this._clockInterval = window.setInterval(() => this._updateClock(), 1000);
  }

  _updateClock() {
    if (!this._timeEl || !this._dateEl) {
      return;
    }

    const locale = this._hass?.locale?.language || navigator.language || 'en-US';
    const tz = this._hass?.config?.time_zone;
    const use12h = this._hass?.locale?.time_format === '12';
    const now = new Date();

    const timeFormatter = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: use12h ?? true,
      timeZone: tz,
    });

    const dateFormatter = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    });

    this._timeEl.textContent = timeFormatter.format(now);
    this._dateEl.textContent = dateFormatter.format(now);
  }

  _resolveNowPlayingEntity() {
    const raw = this._config?.now_playing_entity;
    if (!raw) {
      return null;
    }
    if (typeof raw === 'string' && raw.trim().toLowerCase() === 'auto') {
      const pulseHost = this._extractPulseHostFromQuery();
      if (!pulseHost) {
        return null;
      }
      return `sensor.${this._sanitizeHostname(pulseHost)}_now_playing`;
    }
    return raw;
  }

  _resolveOverlayRefreshEntity() {
    const raw = this._config?.overlay_refresh_entity;
    if (raw === undefined || raw === null) {
      return this._autoOverlayRefreshEntity();
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.toLowerCase() === 'auto') {
        return this._autoOverlayRefreshEntity();
      }
      return trimmed;
    }
    return null;
  }

  _autoOverlayRefreshEntity() {
    const pulseHost = this._extractPulseHostFromQuery();
    if (!pulseHost) {
      return null;
    }
    return `sensor.${this._sanitizeHostname(pulseHost)}_overlay_refresh`;
  }

  _configureOverlayEndpoint() {
    const explicitUrl =
      typeof this._config.overlay_url === 'string' && this._config.overlay_url.trim().length > 0
        ? this._config.overlay_url.trim()
        : null;
    const host = this._extractPulseHostFromQuery();
    const overlayHost = this._normalizeOverlayHostname(host);
    const inferredUrl = overlayHost ? `http://${overlayHost}:8800/overlay` : null;
    this._overlayUrl = explicitUrl || inferredUrl;
    const enabled =
      typeof this._config.overlay_enabled === 'boolean'
        ? this._config.overlay_enabled
        : Boolean(this._overlayUrl);
    this._overlayEnabled = enabled && Boolean(this._overlayUrl);
    this._overlayRefreshEntity = this._resolveOverlayRefreshEntity();
    const pollSeconds = Number(this._config.overlay_poll_seconds);
    this._overlayPollMs = Number.isFinite(pollSeconds) && pollSeconds > 0 ? pollSeconds * 1000 : 120000;
    if (!this._overlayEnabled) {
      this._overlayUrl = null;
    }
    const hostname = host || 'none';
    this._logToHA('info', `overlay config: enabled=${this._overlayEnabled}, url=${this._overlayUrl || 'none'}, refreshEntity=${this._overlayRefreshEntity || 'none'}, pollMs=${this._overlayPollMs}`);
    this._updateOverlayStatus();
  }

  _ensureOverlayPolling() {
    if (!this._overlayEnabled) {
      if (this._overlayPollTimer) {
        clearInterval(this._overlayPollTimer);
        this._overlayPollTimer = null;
      }
      return;
    }
    if (this._overlayPollTimer) {
      clearInterval(this._overlayPollTimer);
    }
    if (this._overlayPollMs <= 0) {
      this._overlayPollTimer = null;
      return;
    }
    this._overlayPollTimer = window.setInterval(() => this._handleOverlayRefreshTrigger('interval'), this._overlayPollMs);
  }

  _handleOverlayRefreshTrigger(source) {
    if (!this._overlayEnabled || !this._overlayUrl || !this.isConnected) {
      return;
    }
    let triggerKey = null;
    if (this._overlayRefreshEntity) {
      const entity = this._hass?.states?.[this._overlayRefreshEntity];
      if (entity) {
        triggerKey = `${entity.state ?? ''}|${entity.attributes?.version ?? ''}|${entity.last_changed ?? ''}`;
      }
    }

    // Also check if now playing entity changed
    let nowPlayingTriggerKey = null;
    if (this._resolvedNowPlayingEntity) {
      const nowPlayingEntity = this._hass?.states?.[this._resolvedNowPlayingEntity];
      if (nowPlayingEntity) {
        // Track state, attributes, and last_changed to detect any changes
        const state = nowPlayingEntity.state ?? '';
        const attrs = nowPlayingEntity.attributes || {};
        const mediaTitle = attrs.media_title || attrs.media_album_name || '';
        const mediaArtist = attrs.media_artist || attrs.media_album_artist || '';
        nowPlayingTriggerKey = `${state}|${mediaTitle}|${mediaArtist}|${nowPlayingEntity.last_changed ?? ''}`;
      }
    }

    const now = Date.now();

    // Check overlay refresh entity first
    if (triggerKey && triggerKey !== this._overlayLastTrigger) {
      this._overlayLastTrigger = triggerKey;
      if (nowPlayingTriggerKey) {
        this._overlayLastNowPlayingTrigger = nowPlayingTriggerKey;
      }
      this._fetchOverlayRemote({ reason: 'entity', cacheKey: triggerKey });
      return;
    }

    // Check now playing entity for changes
    if (nowPlayingTriggerKey && nowPlayingTriggerKey !== this._overlayLastNowPlayingTrigger) {
      this._overlayLastNowPlayingTrigger = nowPlayingTriggerKey;
      this._fetchOverlayRemote({ reason: 'now_playing', cacheKey: nowPlayingTriggerKey });
      return;
    }

    if (!this._overlayActive || now - this._overlayLastFetch >= this._overlayPollMs) {
      this._fetchOverlayRemote({ reason: source || 'poll' });
    }
  }

  async _fetchOverlayRemote({ reason, cacheKey } = {}) {
    if (!this._overlayUrl || !this._remoteOverlayFrame) {
      return;
    }
    const url = this._appendCacheBuster(this._overlayUrl, cacheKey || `${reason || 'poll'}-${Date.now()}`);
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      this._remoteOverlayFrame.srcdoc = html;
      this._overlayActive = true;
      this._overlayLastFetch = Date.now();
      this._logToHA('debug', `overlay fetch succeeded (${reason || 'unknown'}), showing remote overlay`);
      this._showRemoteOverlay(true);
      this._updateOverlayStatus();
    } catch (err) {
      console.warn('pulse-photo-card: overlay fetch failed', err);
      this._logOverlayError(url, err, reason);
      this._overlayActive = false;
      this._showRemoteOverlay(false);
      this._updateOverlayStatus();
    }
  }

  _logToHA(level, message) {
    if (!this._hass) {
      return;
    }
    const host = this._extractPulseHostFromQuery() || 'unknown';
    const fullMessage = `pulse-photo-card [${host}]: ${message}`;
    try {
      this._hass.callService('system_log', 'write', {
        message: fullMessage,
        level: level || 'info',
        logger: 'pulse-photo-card',
      });
    } catch (logErr) {
      // Silently fail if logging service isn't available
      console.debug('pulse-photo-card: failed to log to HA system log', logErr);
    }
  }

  _logOverlayError(url, error, reason) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this._logToHA('warning', `overlay fetch failed (${reason || 'unknown'}): ${errorMsg} - URL: ${url}`);
  }

  _showRemoteOverlay(showRemote) {
    if (!this._legacyOverlayEl) {
      return;
    }

    if (this._remoteOverlayEl) {
      if (showRemote) {
        this._remoteOverlayEl.classList.remove('hidden');
      } else {
        this._remoteOverlayEl.classList.add('hidden');
      }
    }

    if (showRemote) {
      this._legacyOverlayEl.classList.add('hidden');
      // Also hide legacy Now Playing badge
      if (this._nowPlayingEl) {
        this._nowPlayingEl.classList.remove('visible');
      }
    } else {
      this._legacyOverlayEl.classList.remove('hidden');
    }

    // Defensive check: ensure only one overlay is visible
    const legacyVisible = !this._legacyOverlayEl.classList.contains('hidden');
    const remoteVisible = this._remoteOverlayEl && !this._remoteOverlayEl.classList.contains('hidden');
    if (legacyVisible && remoteVisible) {
      this._legacyOverlayEl.classList.add('hidden');
      if (this._nowPlayingEl) {
        this._nowPlayingEl.classList.remove('visible');
      }
    }
  }

  _appendCacheBuster(url, token) {
    if (!token) {
      return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${encodeURIComponent(token)}`;
  }

  _updateOverlayStatus() {
    if (!this._overlayStatusEl) {
      return;
    }
    const emojiEl = this._overlayStatusEl.querySelector('.overlay-status__emoji');
    const textEl = this._overlayStatusEl.querySelector('.overlay-status__text');
    if (!emojiEl || !textEl) {
      return;
    }
    if (this._overlayEnabled && this._overlayActive) {
      this._overlayStatusEl.classList.add('hidden');
      return;
    }
    this._overlayStatusEl.classList.remove('hidden');
    if (this._overlayEnabled) {
      emojiEl.textContent = '🚫';
      textEl.textContent = 'Pulse overlay unavailable';
    } else {
      emojiEl.textContent = '🕒';
      textEl.textContent = 'Legacy overlay';
    }
  }

  _extractPulseHostFromQuery() {
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get('pulse_host');
      return value ? value.trim() : null;
    } catch (err) {
      return null;
    }
  }

  _normalizeOverlayHostname(host) {
    if (!host) {
      return null;
    }
    const trimmed = host.trim();
    if (!trimmed) {
      return null;
    }
    // Hostnames with dots (domain/IP) or colons (IPv6) already include a domain segment.
    if (trimmed.includes('.') || trimmed.includes(':')) {
      return trimmed;
    }
    return `${trimmed}.local`;
  }

  _sanitizeHostname(value) {
    return value.toLowerCase().replace(/[-.]/g, '_');
  }

}

customElements.define('pulse-photo-card', PulsePhotoCard);
