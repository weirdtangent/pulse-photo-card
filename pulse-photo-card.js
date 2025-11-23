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
    this._homePath = null;
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
      secondary_urls: [],
      now_playing_entity: null,
      now_playing_label: 'Now Playing',
      overlay_enabled: undefined,
      overlay_url: undefined,
      overlay_refresh_entity: undefined,
      overlay_poll_seconds: 120,
      ...config,
    };

    if (typeof this._config.now_playing_entity === 'string') {
      const trimmed = this._config.now_playing_entity.trim();
      this._config.now_playing_entity = trimmed.length > 0 ? trimmed : null;
    }

    if (!this._config.now_playing_label) {
      this._config.now_playing_label = 'Now Playing';
    }

    // Ensure secondary_urls is an array
    if (!Array.isArray(this._config.secondary_urls)) {
      this._config.secondary_urls = [];
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
          background: #000;
        }

        ha-card {
          position: relative;
          overflow: hidden;
          cursor: ${this._config.secondary_urls.length > 0 ? 'pointer' : 'default'};
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
        <div class="overlay-status">
          <span class="overlay-status__emoji" aria-hidden="true">🕒</span>
          <span class="overlay-status__text">Legacy overlay</span>
        </div>
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

    // Store the home path (current path when card is initialized)
    this._homePath = window.location.pathname;

    // Set up tap handler if secondary URLs are configured
    if (this._config.secondary_urls.length > 0) {
      // Set up local tap handler for the card itself
      this._card.addEventListener('click', (e) => this._handleTap(e));

      // Also set up global tap handler that works on any dashboard
      if (window.PulsePhotoCardGlobalTap && window.PulsePhotoCardGlobalTap.setup) {
        window.PulsePhotoCardGlobalTap.setup(this._homePath, this._config.secondary_urls);
      }

      // Initialize the current index based on the current URL
      this._initializeUrlIndex();
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
  }

  set hass(hass) {
    this._hass = hass;
    this._startClock();
    if (!this._config) {
      return;
    }

    // Re-initialize URL index if secondary URLs are configured
    // This handles cases where the page has navigated and the card needs to update its state
    if (this._config.secondary_urls && this._config.secondary_urls.length > 0 && this._homePath) {
      this._initializeUrlIndex();
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
    const inferredUrl = host ? `http://${host}:8800/overlay` : null;
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

  _sanitizeHostname(value) {
    return value.toLowerCase().replace(/[-.]/g, '_');
  }

  _findUrlIndex(path, secondaryUrls, homePath) {
    const normalizedPath = this._normalizePath(path);

    if (normalizedPath === this._normalizePath(homePath)) {
      return 0; // Home
    }

    const matchingIndex = secondaryUrls.findIndex(url => {
      return this._normalizePath(url) === normalizedPath;
    });

    return matchingIndex >= 0 ? matchingIndex + 1 : null;
  }

  _initializeUrlIndex() {
    const currentPath = window.location.pathname;
    const storageKey = `pulse-photo-card-url-index-${this._homePath}`;
    const index = this._findUrlIndex(currentPath, this._config.secondary_urls, this._homePath);

    if (index !== null) {
      localStorage.setItem(storageKey, index.toString());
    }
  }

  _handleTap(e) {
    if (!this._config.secondary_urls || this._config.secondary_urls.length === 0) {
      return;
    }

    // Skip tap handling if disable_km parameter is present (used for editing)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('disable_km')) {
      return;
    }

    // Use home path as storage key to maintain state across navigation
    const storageKey = `pulse-photo-card-url-index-${this._homePath}`;

    // Get current index from localStorage, default to 0 (home screen)
    let currentIndex = parseInt(localStorage.getItem(storageKey) || '0', 10);

    // Increment index and wrap around (0 = home, 1+ = secondary URLs)
    currentIndex = (currentIndex + 1) % (this._config.secondary_urls.length + 1);

    // Navigate based on index
    if (currentIndex === 0) {
      // Navigate back to home
      this._navigateToPath(this._homePath);
    } else {
      // Navigate to secondary URL (index - 1 because 0 is home)
      const targetUrl = this._config.secondary_urls[currentIndex - 1];
      this._navigateToPath(targetUrl);
    }

    // Store the new index
    localStorage.setItem(storageKey, currentIndex.toString());
  }

  _normalizePath(path) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  _preserveKioskParams(path) {
    const normalizedPath = this._normalizePath(path);
    const currentParams = new URLSearchParams(window.location.search);
    const kioskParams = new URLSearchParams();

    // Preserve parameters that control kiosk mode
    if (currentParams.has('sidebar')) {
      kioskParams.set('sidebar', currentParams.get('sidebar'));
    }
    if (currentParams.has('disable_km')) {
      kioskParams.set('disable_km', currentParams.get('disable_km'));
    }

    const newSearch = kioskParams.toString();
    return normalizedPath + (newSearch ? '?' + newSearch : '');
  }

  _navigateToPath(path) {
    const newUrl = this._preserveKioskParams(path);
    window.location.href = newUrl;
  }
}

customElements.define('pulse-photo-card', PulsePhotoCard);

// Global tap handler for navigation cycling
// This allows taps to work on any dashboard, not just the photo frame
(function() {
  'use strict';

  let globalTapHandler = null;

  // Detect if we're running on a Pulse device (kiosk mode)
  // Only enable global tap handler on Pulse, not on desktop browsers
  function isPulseDevice() {
    // Check for explicit disable flag in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('pulse_tap_disable')) {
      return false;
    }

    // Check if we're in fullscreen/kiosk mode
    // Pulse runs Chromium with --kiosk flag, which puts it in fullscreen
    const isFullscreen = window.innerHeight === screen.height &&
                         window.innerWidth === screen.width &&
                         !window.navigator.standalone; // Exclude iOS standalone mode

    // Additional check: if window.chrome exists and we're in a very specific fullscreen state
    // This is a heuristic - Pulse devices run in kiosk mode
    const isLikelyKiosk = isFullscreen &&
                          document.fullscreenElement === null && // Not programmatic fullscreen
                          window.screen.availHeight === window.innerHeight; // Using full screen

    return isLikelyKiosk;
  }

  // Shared utility functions
  function normalizePath(path) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  function preserveKioskParams(path) {
    const normalizedPath = normalizePath(path);
    const currentParams = new URLSearchParams(window.location.search);
    const kioskParams = new URLSearchParams();

    if (currentParams.has('sidebar')) {
      kioskParams.set('sidebar', currentParams.get('sidebar'));
    }
    if (currentParams.has('disable_km')) {
      kioskParams.set('disable_km', currentParams.get('disable_km'));
    }

    const newSearch = kioskParams.toString();
    return normalizedPath + (newSearch ? '?' + newSearch : '');
  }

  function findUrlIndex(path, secondaryUrls, homePath) {
    const normalizedPath = normalizePath(path);
    const normalizedHome = normalizePath(homePath);

    if (normalizedPath === normalizedHome) {
      return 0; // Home
    }

    const matchingIndex = secondaryUrls.findIndex(url => {
      return normalizePath(url) === normalizedPath;
    });

    return matchingIndex >= 0 ? matchingIndex + 1 : null;
  }

  function setupGlobalTapHandler(homePath, secondaryUrls) {
    // Only enable on Pulse devices, not on desktop browsers
    if (!isPulseDevice()) {
      // Clear any existing config and handler if we're not on Pulse
      if (globalTapHandler) {
        document.removeEventListener('click', globalTapHandler, true);
        globalTapHandler = null;
      }
      const configKey = `pulse-photo-card-config-${homePath}`;
      localStorage.removeItem(configKey);
      return;
    }

    // Remove existing handler if any
    if (globalTapHandler) {
      document.removeEventListener('click', globalTapHandler, true);
      globalTapHandler = null;
    }

    if (!secondaryUrls || secondaryUrls.length === 0) {
      // Clear stored config if URLs are removed
      const configKey = `pulse-photo-card-config-${homePath}`;
      localStorage.removeItem(configKey);
      return;
    }

    // Store config in localStorage so it persists across page navigations
    const configKey = `pulse-photo-card-config-${homePath}`;
    localStorage.setItem(configKey, JSON.stringify({ homePath, secondaryUrls }));

    globalTapHandler = function(e) {
      // Double-check we're on Pulse device (in case detection changes)
      if (!isPulseDevice()) {
        return;
      }

      // Load config from localStorage
      const keys = Object.keys(localStorage);
      let config = null;
      for (const key of keys) {
        if (key.startsWith('pulse-photo-card-config-')) {
          try {
            const configStr = localStorage.getItem(key);
            if (configStr) {
              const candidate = JSON.parse(configStr);
              if (candidate.secondaryUrls && candidate.secondaryUrls.length > 0) {
                config = candidate;
                break;
              }
            }
          } catch (err) {
            // Invalid config, continue
          }
        }
      }

      if (!config || !config.secondaryUrls || config.secondaryUrls.length === 0) {
        return;
      }

      const { homePath: configHomePath, secondaryUrls } = config;

      // Skip tap handling if disable_km parameter is present (used for editing)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('disable_km')) {
        return;
      }

      // Only handle taps on the main content area, not on interactive elements
      const target = e.target;
      if (target.tagName === 'A' ||
          target.tagName === 'BUTTON' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('ha-button') ||
          target.closest('mwc-button') ||
          target.closest('paper-button') ||
          target.closest('a') ||
          target.closest('button') ||
          target.closest('[role="button"]') ||
          target.closest('ha-card[tabindex]')) {
        return;
      }

      // Skip if clicking on cards that have their own tap actions
      if (target.closest('hui-card') && target.closest('hui-card').config?.tap_action) {
        return;
      }

      const storageKey = `pulse-photo-card-url-index-${configHomePath}`;
      const currentPath = window.location.pathname;

      // Determine current index - check stored value first, then verify against actual path
      let currentIndex = parseInt(localStorage.getItem(storageKey) || '0', 10);
      const actualIndex = findUrlIndex(currentPath, secondaryUrls, configHomePath);

      // If stored index doesn't match actual path, use actual index
      if (actualIndex !== null) {
        if (currentIndex !== actualIndex) {
          currentIndex = actualIndex;
        }
      } else if (currentIndex > 0) {
        // Stored index suggests we're on a secondary URL, but path doesn't match
        // This might be a stale state, so don't handle
        return;
      }

      // Increment index and wrap around (0 = home, 1+ = secondary URLs)
      currentIndex = (currentIndex + 1) % (secondaryUrls.length + 1);

      // Determine target path
      const targetPath = currentIndex === 0 ? configHomePath : secondaryUrls[currentIndex - 1];

      // Prevent default behavior and stop propagation
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Store the new index
      localStorage.setItem(storageKey, currentIndex.toString());

      // Navigate with preserved kiosk parameters
      window.location.href = preserveKioskParams(targetPath);
    };

    // Use capture phase to catch clicks early, but allow other handlers to work
    document.addEventListener('click', globalTapHandler, true);
  }

  // Initialize on page load if we're in cycling mode
  function initializeOnLoad() {
    // Only initialize on Pulse devices
    if (!isPulseDevice()) {
      // Clean up any leftover config from desktop testing
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('pulse-photo-card-config-') ||
            key.startsWith('pulse-photo-card-url-index-')) {
          localStorage.removeItem(key);
        }
      }
      return;
    }

    // Check if we have any stored config indicating we're in cycling mode
    // Look for localStorage keys that match the pattern
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('pulse-photo-card-config-')) {
        try {
          const configStr = localStorage.getItem(key);
          if (!configStr) continue;

          const config = JSON.parse(configStr);
          const { homePath, secondaryUrls } = config;

          if (secondaryUrls && secondaryUrls.length > 0) {
            // Set up the global handler with stored config
            setupGlobalTapHandler(homePath, secondaryUrls);
            break;
          }
        } catch (e) {
          // Invalid config, skip
          console.warn('pulse-photo-card: invalid stored config', e);
        }
      }
    }
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOnLoad);
  } else {
    initializeOnLoad();
  }

  // Expose setup function for pulse-photo-card to use
  window.PulsePhotoCardGlobalTap = {
    setup: setupGlobalTapHandler,
  };
})();

