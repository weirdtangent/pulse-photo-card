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
    this._views = [];
    this._currentViewIndex = -1;
    this._viewTimeoutTimer = null;
    this._viewTimeoutSeconds = 180;
    this._viewContainerEl = null;
    this._viewContentEl = null;
    this._navButtonsEl = null;
    this._notificationBarEl = null;
    this._clickThroughLayer = null;
    this._overlayClickBridgeReady = false;
    this._overlayClickBridgeFallbackEnabled = false;
    this._overlayClickBridgeTimer = null;
    this._cardHelpers = null;
    this._renderedCards = [];
    this._lovelaceContext = null;
    this._pendingViewRenderRetry = null;
    this._isRenderingView = false;
    this._viewHasContent = false;
    this._viewTransitioning = false;
    this._viewTransitionTimer = null;
  }

  // ============================================================================
  // Configuration & Initialization
  // ============================================================================
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
      views: [],
      experimental_native_views: false,
      view_timeout_seconds: 180,
      debug: false,
      ...config,
    };

    if (typeof this._config.now_playing_entity === 'string') {
      const trimmed = this._config.now_playing_entity.trim();
      this._config.now_playing_entity = trimmed.length > 0 ? trimmed : null;
    }

    if (!this._config.now_playing_label) {
      this._config.now_playing_label = 'Now Playing';
    }

    // Parse views config
    if (Array.isArray(this._config.views)) {
      this._views = this._config.views;
    } else {
      this._views = [];
    }

    // Parse view timeout
    const timeoutSeconds = Number(this._config.view_timeout_seconds);
    this._viewTimeoutSeconds = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds : 180;

    // Reset view state
    this._currentViewIndex = -1;
    this._clearViewTimeout();
    this._clearViewRenderRetry();
    if (this._viewTransitionTimer) {
      clearTimeout(this._viewTransitionTimer);
      this._viewTransitionTimer = null;
    }
    this._viewTransitioning = false;

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

    // Add version indicator for test card
    // Check if this is the test version by looking at script source or adding a version pill
    const isTestVersion = this._isTestVersion();
    // Also check custom element name as fallback
    const customElementName = this.tagName.toLowerCase();
    const isTestByName = customElementName === 'pulse-photo-card-test';
    const showVersion = isTestVersion || isTestByName;

    const versionPillMarkup = showVersion
      ? `
      `
      : '';

    const remoteOverlayMarkup = this._overlayEnabled
      ? `
            <div class="overlay overlay--remote hidden">
              <iframe class="overlay__frame" title="Pulse overlay" sandbox="allow-scripts allow-forms allow-same-origin" allowtransparency="true"></iframe>
            </div>
          `
      : '';

    const hasViews = this._views && this._views.length > 0;
    const navButtonsMarkup = hasViews
      ? `
        <div class="nav-buttons hidden">
          <button class="nav-button nav-button--prev" aria-label="Previous view">
            <span class="nav-button__emoji">◀</span>
          </button>
          <button class="nav-button nav-button--home" aria-label="Return to photo">
            <span class="nav-button__emoji">🏠</span>
          </button>
          <button class="nav-button nav-button--next" aria-label="Next view">
            <span class="nav-button__emoji">▶</span>
          </button>
        </div>
      `
      : '';

    const viewContainerMarkup = hasViews
      ? `
        <div class="view-container hidden">
          <div class="view-content"></div>
        </div>
      `
      : '';

    const clickThroughLayerMarkup = hasViews
      ? `
        <div class="click-through-layer"></div>
      `
      : '';

    const showNotificationBar = this._config.show_overlay_status || hasViews;
    const notificationBarMarkup = showNotificationBar
      ? `
        <div class="notification-bar">
          ${overlayStatusMarkup}
          ${navButtonsMarkup}
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
          background: #000;
        }

        ha-card.has-views {
          cursor: pointer;
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
          background: transparent !important;
        }

        .notification-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 12px 18px;
          z-index: 10;
          transition: opacity 180ms ease;
        }

        .notification-bar.notification-bar--nav {
          background: rgba(0, 0, 0, 0.35);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(16px);
        }

        .notification-bar.notification-bar--hidden {
          opacity: 0;
          pointer-events: none;
        }

        .overlay-status {
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
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
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

        /* Click-through layer that sits above overlay when on photo screen */
        .click-through-layer {
          position: absolute;
          inset: 0;
          z-index: 2.5;
          pointer-events: auto;
          background: transparent;
          display: none;
        }

        .click-through-layer.active {
          display: block;
        }

        /* When click-through is active, disable pointer events on overlay iframe so clicks pass through */
        .overlay--remote.click-through-active {
          pointer-events: none;
        }

        .overlay--remote.click-through-active .overlay__frame {
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

        .nav-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          order: -1;
          margin-right: auto;
        }

        .nav-buttons.hidden {
          display: none;
        }

        .nav-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          padding: 0;
          border: none;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          transition: background 150ms ease, transform 100ms ease;
          font-family: "Noto Color Emoji", "Inter", "Segoe UI", "Helvetica Neue", sans-serif;
        }

        .nav-button:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.65);
          transform: scale(1.05);
        }

        .nav-button:active:not(:disabled) {
          transform: scale(0.95);
        }

        .nav-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .nav-button__emoji {
          font-size: 1.2rem;
          line-height: 1;
          font-family: "Noto Color Emoji", "Inter", "Segoe UI", "Helvetica Neue", sans-serif;
        }

        .view-container {
          position: absolute;
          inset: 0;
          /* Use background-color with explicit fallback to ensure it's always visible */
          background-color: #1e1e1e;
          background-color: var(--primary-background-color, #1e1e1e);
          background-color: var(--card-background-color, var(--primary-background-color, #1e1e1e));
          background-color: var(--ha-card-background, var(--card-background-color, var(--primary-background-color, #1e1e1e)));
          z-index: 6;
          opacity: 0;
          transition: opacity var(--fade-ms, 500ms) ease-in-out;
          pointer-events: none;
          will-change: opacity; /* Optimize for transition */
        }

        .view-container.visible {
          opacity: 1;
          pointer-events: auto;
        }

        .view-container.hidden {
          display: none;
          pointer-events: none;
        }

        .view-content {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1rem;
          padding-top: 90px;
          min-height: 100%;
          box-sizing: border-box;
          margin: 0 auto;
          width: min(1800px, 100%);
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .view-content > .embedded-ha-view {
          width: 100%;
          min-height: calc(100vh - 70px);
          box-sizing: border-box;
        }

        /* Ensure cards maintain their aspect ratio and aren't stretched */
        .view-content > * {
          max-width: 100%;
          box-sizing: border-box;
        }

        .view-content.view-content--sections {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          align-content: flex-start;
        }

        .view-content.view-content--direct {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
          gap: 1.5rem;
          align-content: flex-start;
        }

        .view-section {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          width: 100%;
        }

        .view-section__title {
          font-size: 0.95rem;
          font-weight: 600;
          opacity: 0.85;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .view-section__stack {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .view-section__grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
          align-items: stretch;
        }

        /* Prevent container cards from forcing dimensions on children */
        .view-content ha-horizontal-stack,
        .view-content ha-vertical-stack,
        .view-content ha-grid {
          display: block;
        }

        /* Ensure custom cards maintain their natural sizing */
        .view-content mini-graph-card,
        .view-content apexcharts-card,
        .view-content * {
          max-width: 100%;
          height: auto;
        }

        /* Allow cards to size naturally within their containers */
        .view-content ha-horizontal-stack > *,
        .view-content ha-vertical-stack > *,
        .view-content ha-grid > * {
          flex: 0 1 auto;
          min-width: 0;
          min-height: 0;
        }

        .view-content::-webkit-scrollbar {
          width: 8px;
        }

        .view-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }

        .view-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        .view-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      </style>

      <ha-card>
        <div class="frame">
          <img class="layer layer-a visible" />
          <img class="layer layer-b" />
        </div>
        ${notificationBarMarkup}
        ${versionPillMarkup}
        ${remoteOverlayMarkup}
        ${clickThroughLayerMarkup}
        ${viewContainerMarkup}
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
    if (this._card && hasViews) {
      this._card.classList.add('has-views');
    }
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

    // Get view-related elements
    this._viewContainerEl = this.shadowRoot.querySelector('.view-container');
    this._viewContentEl = this.shadowRoot.querySelector('.view-content');
    this._navButtonsEl = this.shadowRoot.querySelector('.nav-buttons');
    this._notificationBarEl = this.shadowRoot.querySelector('.notification-bar');
    this._clickThroughLayer = this.shadowRoot.querySelector('.click-through-layer');

    // Set up navigation button handlers
    if (this._navButtonsEl && hasViews) {
      const prevBtn = this._navButtonsEl.querySelector('.nav-button--prev');
      const homeBtn = this._navButtonsEl.querySelector('.nav-button--home');
      const nextBtn = this._navButtonsEl.querySelector('.nav-button--next');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => this._goToPreviousView());
      }
      if (homeBtn) {
        homeBtn.addEventListener('click', () => this._goToPhoto());
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this._goToNextView());
      }
    }

    // Set up tap handler for photo screen and views
    if (hasViews) {
      // Attach to card, but also log for debugging
      this._logToHA('debug', `setting up photo tap handler, views count: ${this._views.length}`);
      this._card.addEventListener('click', (e) => this._handlePhotoTap(e), true); // Use capture phase

      // Also attach to frame element to catch clicks on images
      const frameEl = this.shadowRoot.querySelector('.frame');
      if (frameEl) {
        frameEl.addEventListener('click', (e) => this._handlePhotoTap(e), true);
      }

      // Attach to view container to handle clicks in views
      if (this._viewContainerEl) {
        this._viewContainerEl.addEventListener('click', (e) => this._handlePhotoTap(e), true);
      }

      // Set up click-through layer handler
      // This layer sits between the card and overlay, catching clicks that don't hit overlay interactive elements
      if (this._clickThroughLayer) {
        this._clickThroughLayer.addEventListener('click', (e) => {
          // This will only fire if the click doesn't hit an interactive element in the overlay
          // because those have pointer-events: auto and will stop propagation
          this._handlePhotoTap(e);
        }, true);
      }

      // Set up message listener for overlay iframe clicks
      window.addEventListener('message', (e) => this._handleOverlayMessage(e));
    }

    this._startClock();
    this._updateNowPlaying();
    this._ensureOverlayPolling();
    this._updateOverlayStatus();
    this._updateNavigationButtons();

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

    this._updateClickThroughLayer();
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

  // ============================================================================
  // Lifecycle Hooks
  // ============================================================================
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

    // Update rendered cards with new hass state
    if (this._renderedCards && this._renderedCards.length > 0) {
      this._renderedCards.forEach(card => {
        if (card && card.hass !== undefined) {
          card.hass = hass;
        }
      });
    }
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
    this._clearViewTimeout();
    this._clearViewRenderRetry();
    if (this._viewTransitionTimer) {
      clearTimeout(this._viewTransitionTimer);
      this._viewTransitionTimer = null;
    }
    this._viewTransitioning = false;
    if (this._overlayClickBridgeTimer) {
      clearTimeout(this._overlayClickBridgeTimer);
      this._overlayClickBridgeTimer = null;
    }
    this._overlayClickBridgeFallbackEnabled = false;
    this._overlayClickBridgeReady = false;
    this._cleanupRenderedCards();
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
    this._logToHA('debug', `overlay config: enabled=${this._overlayEnabled}, url=${this._overlayUrl || 'none'}, refreshEntity=${this._overlayRefreshEntity || 'none'}, pollMs=${this._overlayPollMs}`);
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
      const rawHtml = await response.text();
      const overlayHtml = this._injectOverlayClickBridge(rawHtml);
      this._remoteOverlayFrame.srcdoc = overlayHtml;
      this._overlayClickBridgeReady = false;
      this._overlayClickBridgeFallbackEnabled = false;
      this._scheduleOverlayClickBridgeFallback();
      this._updateClickThroughLayer();
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
      this._cancelOverlayClickBridgeFallback();
      this._overlayClickBridgeReady = false;
      this._overlayClickBridgeFallbackEnabled = false;
      this._updateClickThroughLayer();
      this._updateOverlayStatus();
    }
  }

  _logToHA(level, message) {
    const host = this._extractPulseHostFromQuery() || 'unknown';
    const fullMessage = `pulse-photo-card [${host}]: ${message}`;
    const logLevel = level || 'info';
    const isDebug = logLevel === 'debug';

    if (!this._config?.debug && isDebug) {
      return;
    }

    if (logLevel === 'error') {
      console.error(fullMessage);
    } else if (logLevel === 'warning') {
      console.warn(fullMessage);
    } else if (isDebug) {
      console.debug(fullMessage);
    } else {
      console.log(fullMessage);
    }

    // Only send non-debug logs to HA system log
    if (!isDebug && this._hass) {
      try {
        this._hass.callService('system_log', 'write', {
          message: fullMessage,
          level: logLevel,
          logger: 'pulse-photo-card',
        });
      } catch (logErr) {
        // Silently fail if logging service isn't available
      }
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

    // Show/hide click-through layer when overlay is active and on photo screen
    if (showRemote) {
      this._legacyOverlayEl.classList.add('hidden');
      // Also hide legacy Now Playing badge
      if (this._nowPlayingEl) {
        this._nowPlayingEl.classList.remove('visible');
      }
    } else {
      this._legacyOverlayEl.classList.remove('hidden');
      this._cancelOverlayClickBridgeFallback();
      this._overlayClickBridgeReady = false;
      this._overlayClickBridgeFallbackEnabled = false;
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

    this._updateClickThroughLayer();
  }

  _injectOverlayClickBridge(html) {
    if (!html || typeof html !== 'string') {
      return html;
    }
    if (!this._overlayEnabled || !this._views || this._views.length === 0) {
      return html;
    }
    if (html.includes('__pulsePhotoCardClickBridge')) {
      return html;
    }
    const bridgeScript = `
      <script>
        (function() {
          if (window.__pulsePhotoCardClickBridgeInstalled) {
            try {
              window.parent.postMessage({ type: 'pulse-photo-card-click-bridge', status: 'ready' }, '*');
            } catch (bridgeErr) {
              // ignore
            }
            return;
          }
          window.__pulsePhotoCardClickBridgeInstalled = true;
          var selectors = 'a,button,input,select,textarea,label,[role="button"],[role="link"],[data-action],[data-interactive]';
          var notifyReady = function() {
            try {
              window.parent.postMessage({ type: 'pulse-photo-card-click-bridge', status: 'ready' }, '*');
            } catch (notifyErr) {
              // ignore
            }
          };
          var isInteractive = function(node) {
            if (!node) {
              return false;
            }
            if (node.nodeType === 3) {
              node = node.parentElement;
            }
            while (node) {
              if (node.matches && node.matches(selectors)) {
                return true;
              }
              node = node.parentElement;
            }
            return false;
          };
          window.addEventListener('click', function(event) {
            try {
              var target = event.target;
              if (isInteractive(target) || event.defaultPrevented) {
                return;
              }
              window.parent.postMessage({ type: 'pulse-photo-card-click', handled: false }, '*');
            } catch (clickErr) {
              // ignore
            }
          }, true);
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            notifyReady();
          } else {
            document.addEventListener('DOMContentLoaded', notifyReady, { once: true });
          }
        })();
      </script>
    `;
    if (html.includes('</body>')) {
      return html.replace('</body>', `${bridgeScript}</body>`);
    }
    if (html.includes('</html>')) {
      return html.replace('</html>', `${bridgeScript}</html>`);
    }
    return `${html}${bridgeScript}`;
  }

  _scheduleOverlayClickBridgeFallback() {
    if (this._overlayClickBridgeTimer) {
      clearTimeout(this._overlayClickBridgeTimer);
    }
    this._overlayClickBridgeTimer = window.setTimeout(() => {
      if (!this._overlayClickBridgeReady) {
        this._overlayClickBridgeFallbackEnabled = true;
        this._logToHA('debug', "overlay click bridge timeout, enabling click-through fallback");
        this._updateClickThroughLayer();
      }
    }, 2000);
  }

  _cancelOverlayClickBridgeFallback() {
    if (this._overlayClickBridgeTimer) {
      clearTimeout(this._overlayClickBridgeTimer);
      this._overlayClickBridgeTimer = null;
    }
    this._overlayClickBridgeFallbackEnabled = false;
  }

  _updateClickThroughLayer() {
    if (!this._clickThroughLayer || !this._remoteOverlayEl) {
      return;
    }
    const hasViews = this._views && this._views.length > 0;
    const onPhotoScreen = this._currentViewIndex === -1;
    const remoteVisible = !this._remoteOverlayEl.classList.contains('hidden');
    const shouldEnable = this._overlayClickBridgeFallbackEnabled && hasViews && onPhotoScreen && remoteVisible;
    if (shouldEnable) {
      this._clickThroughLayer.classList.add('active');
      this._remoteOverlayEl.classList.add('click-through-active');
    } else {
      this._clickThroughLayer.classList.remove('active');
      this._remoteOverlayEl.classList.remove('click-through-active');
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

    this._updateNavigationButtons();
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

  _isTestVersion() {
    // Check if this is the test version by looking for "test" in script sources
    try {
      // First check the custom element name (most reliable)
      const customElementName = this.tagName.toLowerCase();
      if (customElementName === 'pulse-photo-card-test') {
        return true;
      }

      // Check all script tags
      const scripts = document.querySelectorAll('script[src*="pulse-photo-card"]');
      for (const script of scripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('pulse-photo-card-test') ||
            (src.includes('pulse-photo-card') && src.includes('test'))) {
          return true;
        }
      }
      // Check module scripts
      const moduleScripts = document.querySelectorAll('script[type="module"][src*="pulse-photo-card"]');
      for (const script of moduleScripts) {
        const src = script.getAttribute('src') || '';
        if (src.includes('pulse-photo-card-test') ||
            (src.includes('pulse-photo-card') && src.includes('test'))) {
          return true;
        }
      }
      // Check if loaded via import (check import.meta if available)
      try {
        if (import.meta && import.meta.url) {
          if (import.meta.url.includes('pulse-photo-card-test') ||
              (import.meta.url.includes('pulse-photo-card') && import.meta.url.includes('test'))) {
            return true;
          }
        }
      } catch (err) {
        // import.meta not available in this context
      }
      // Check window location for test indicator
      if (window.location.href.includes('pulse-photo-card-test')) {
        return true;
      }
      // Check current script if available
      if (document.currentScript && document.currentScript.src) {
        const src = document.currentScript.src;
        if (src.includes('pulse-photo-card-test') ||
            (src.includes('pulse-photo-card') && src.includes('test'))) {
          return true;
        }
      }
    } catch (err) {
      // Silently fail
    }
    return false;
  }

  _getVersionHash() {
    // Generate a simple hash from the current timestamp and some code characteristics
    // This will change when the code changes, giving a unique identifier
    const codeMarker = 'pulse-photo-card-views-v1';
    const timestamp = Date.now().toString(36).slice(-6);
    // Create a simple hash from code marker + timestamp
    let hash = 0;
    const str = codeMarker + timestamp;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).slice(0, 6).toUpperCase();
  }

  // ============================================================================
  // Photo Tap & Navigation Handling
  // ============================================================================
  _handlePhotoTap(e) {
    // Skip tap handling if disable_km parameter is present (used for editing)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('disable_km')) {
      return;
    }

    // Ignore taps on interactive elements
    const target = e.target;

    // Check for obvious interactive elements first
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
        target.closest('.nav-buttons') ||
        target.closest('.overlay__content') ||
        target.closest('.overlay--legacy')) {
      return;
    }

    // Handle taps on photo screen (index -1) - navigate to first view
    if (this._currentViewIndex === -1) {
      if (this._views && this._views.length > 0) {
        this._logToHA('debug', `photo tapped (target: ${target.tagName}), navigating to first view`);
        e.preventDefault();
        e.stopPropagation();
        this._goToView(0);
      }
      return;
    }

    // Handle taps on view screens - return to photo if clicking on blank area
    if (this._currentViewIndex >= 0) {
      const clickedInsideView = this._viewContentEl && (target === this._viewContentEl || this._viewContentEl.contains(target));
      if (!clickedInsideView) {
        return;
      }

      // If the click originated from any rendered card, ignore it
      const cardHost = target.closest('[data-view-card]');
      if (cardHost) {
        return;
      }

      // Otherwise treat as blank space tap
      this._logToHA('debug', `view blank area tapped (target: ${target.tagName}), returning to photo`);
      e.preventDefault();
      e.stopPropagation();
      this._goToPhoto();
    }
  }

  _goToView(index) {
    if (!this._views || index < 0 || index >= this._views.length) {
      this._logToHA('warning', `invalid view index: ${index}`);
      return;
    }

    this._logToHA('debug', `navigating to view ${index}`);
    this._currentViewIndex = index;
    this._clearViewTimeout(); // Clear any existing timeout
    this._renderCurrentView();
    this._updateNavigationButtons();
    this._updateClickThroughLayer();
    // Start timeout after view is shown (after fade transition)
    const fadeMs = this._config.fade_ms || 500;
    setTimeout(() => {
      // Only start timeout if we're still on this view (didn't navigate away)
      if (this._currentViewIndex === index) {
        this._startViewTimeout();
      }
    }, fadeMs + 100);
  }

  _goToPreviousView() {
    if (!this._views || this._views.length === 0) {
      return;
    }

    if (this._currentViewIndex === 0) {
      // From first view, go back to photo
      this._goToPhoto();
    } else if (this._currentViewIndex > 0) {
      // Go to previous view
      this._goToView(this._currentViewIndex - 1);
    }
    // If already on photo (index -1), do nothing
  }

  _goToNextView() {
    if (!this._views || this._views.length === 0) {
      return;
    }

    if (this._currentViewIndex >= this._views.length - 1) {
      // Wrap to photo
      this._goToPhoto();
    } else {
      this._goToView(this._currentViewIndex + 1);
    }
  }

  _goToPhoto() {
    this._logToHA('debug', `returning to photo screen`);
    this._currentViewIndex = -1;
    this._clearViewTimeout();
    this._hideView();
    this._updateNavigationButtons();
    this._updateClickThroughLayer();
  }

  _updateNavigationButtons() {
    if (!this._navButtonsEl || !this._views || this._views.length === 0) {
      return;
    }

    const isOnPhoto = this._currentViewIndex === -1;
    const isOnFirstView = this._currentViewIndex === 0;
    const isOnLastView = this._currentViewIndex === this._views.length - 1;
    const isTransitioning = this._viewTransitioning;

    // Show/hide navigation buttons
    if (isOnPhoto || !this._viewHasContent || isTransitioning) {
      this._navButtonsEl.classList.add('hidden');
    } else {
      this._navButtonsEl.classList.remove('hidden');
    }

    // Update button states
    const prevBtn = this._navButtonsEl.querySelector('.nav-button--prev');
    const homeBtn = this._navButtonsEl.querySelector('.nav-button--home');
    const nextBtn = this._navButtonsEl.querySelector('.nav-button--next');

    if (prevBtn) {
      // Allow wrapping from first view to last view
      prevBtn.disabled = false;
    }
    if (homeBtn) {
      homeBtn.disabled = false; // Always enabled when visible
    }
    if (nextBtn) {
      nextBtn.disabled = isOnLastView;
    }

    if (this._notificationBarEl) {
      const overlayVisible = !!(this._overlayStatusEl && !this._overlayStatusEl.classList.contains('hidden'));
      const navVisible = !this._navButtonsEl.classList.contains('hidden');
      if (navVisible) {
        this._notificationBarEl.classList.add('notification-bar--nav');
      } else {
        this._notificationBarEl.classList.remove('notification-bar--nav');
      }
      if (!overlayVisible && !navVisible) {
        this._notificationBarEl.classList.add('notification-bar--hidden');
      } else {
        this._notificationBarEl.classList.remove('notification-bar--hidden');
      }
    }
  }

  // ============================================================================
  // View Rendering Pipeline
  // ============================================================================
  async _renderCurrentView() {
    if (this._currentViewIndex < 0 || !this._views || this._currentViewIndex >= this._views.length) {
      return;
    }
    if (this._isRenderingView) {
      this._logToHA('debug', 'view render requested while another render is in progress');
      return;
    }
    const view = this._views[this._currentViewIndex];
    if (!view) {
      this._logToHA('warning', `view at index ${this._currentViewIndex} is invalid`);
      return;
    }

    this._isRenderingView = true;
    this._viewHasContent = false;
    this._updateNavigationButtons();

    // Clean up previous cards and pending retries
    this._cleanupRenderedCards();
    this._clearViewRenderRetry();

    if (!this._viewContainerEl || !this._viewContentEl) {
      this._logToHA('error', 'missing view container or content element; cannot render view');
      this._isRenderingView = false;
      return;
    }
    this._logToHA('debug', `starting view render ${this._currentViewIndex}`);

    // Ensure background is visible immediately so first render isn't black
    this._showView();
    this._logToHA('debug', `view container classes after _showView: ${[...this._viewContainerEl.classList].join(', ')}`);
    this._viewContentEl.innerHTML = '';
    this._viewContentEl.classList.remove('view-content--sections', 'view-content--direct');

    // Try to use HA's native view rendering first for accurate layouts (opt-in)
    if (this._config.experimental_native_views) {
      try {
        const renderedNative = await this._tryRenderWithNativeView(view);
        if (renderedNative) {
          this._logToHA('debug', `rendered view ${this._currentViewIndex} using native HA renderer`);
          this._isRenderingView = false;
          this._viewHasContent = true;
          this._updateNavigationButtons();
          return;
        }
      } catch (nativeErr) {
        this._logToHA('warning', `native HA view rendering failed: ${nativeErr?.message || nativeErr}`);
      }
    }

    // Load card helpers if not already loaded
    if (!this._cardHelpers) {
      try {
        this._cardHelpers = await window.loadCardHelpers();
        this._logToHA('debug', 'card helpers loaded');
      } catch (err) {
        this._logToHA('error', `failed to load card helpers: ${err.message || String(err)}`);
        this._isRenderingView = false;
        this._scheduleViewRenderRetry('card helpers unavailable');
        return;
      }
    }

    // Ensure custom card definitions are registered before rendering
    try {
      const customTags = this._collectCustomCardTags(view);
      if (customTags.size > 0) {
        this._logToHA('debug', `waiting for ${customTags.size} custom card definitions before rendering view`);
        await this._waitForCustomCardDefinitions(customTags);
      }
    } catch (waitErr) {
      this._logToHA('warning', `error while waiting for custom cards: ${waitErr?.message || waitErr}`);
    }

    try {
      let cardCount = 0;
      // Handle different view types
      if (view.type === 'sections' && view.sections) {
        this._viewContentEl.classList.add('view-content--sections');
        this._logToHA('debug', `view has ${view.sections.length} sections`);
        for (let i = 0; i < view.sections.length; i++) {
          const section = view.sections[i];
          this._logToHA('debug', `processing section ${i}: type=${section.type}, cards=${section.cards?.length || 0}`);
          const sectionEl = document.createElement('div');
          sectionEl.classList.add('view-section');
          if (section.title) {
            const titleEl = document.createElement('div');
            titleEl.classList.add('view-section__title');
            titleEl.textContent = section.title;
            sectionEl.appendChild(titleEl);
          }

          let cardsHost = null;
          if (section.type === 'grid') {
            const gridEl = document.createElement('div');
            gridEl.classList.add('view-section__grid');
            const columns = Number(section.columns || section.max_columns || section.grid?.columns);
            if (Number.isFinite(columns) && columns > 0) {
              gridEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
            }
            const columnWidth = section.grid?.column_width;
            if (columnWidth) {
              gridEl.style.gridAutoColumns = columnWidth;
            }
            cardsHost = gridEl;
          } else {
            const stackEl = document.createElement('div');
            stackEl.classList.add('view-section__stack');
            cardsHost = stackEl;
          }
          sectionEl.appendChild(cardsHost);
          this._viewContentEl.appendChild(sectionEl);

          if (section.type === 'grid' && section.cards && Array.isArray(section.cards)) {
            this._logToHA('debug', `grid section ${i} has ${section.cards.length} cards`);
            for (let j = 0; j < section.cards.length; j++) {
              const cardConfig = section.cards[j];
              const nestedCount = cardConfig.cards ? cardConfig.cards.length : 0;
              this._logToHA('debug', `rendering card ${j} in grid section ${i}: ${cardConfig.type || 'unknown'}${nestedCount > 0 ? ` (${nestedCount} nested)` : ''}`);
              const success = await this._renderCard(cardConfig, cardsHost);
              if (success) {
                cardCount++;
              }
            }
          } else if (section.cards && Array.isArray(section.cards)) {
            this._logToHA('debug', `section ${i} has ${section.cards.length} cards`);
            for (let j = 0; j < section.cards.length; j++) {
              const cardConfig = section.cards[j];
              const nestedCount = cardConfig.cards ? cardConfig.cards.length : 0;
              this._logToHA('debug', `rendering card ${j} in section ${i}: ${cardConfig.type || 'unknown'}${nestedCount > 0 ? ` (${nestedCount} nested)` : ''}`);
              const success = await this._renderCard(cardConfig, cardsHost);
              if (success) {
                cardCount++;
              }
            }
          }
        }
      } else if (view.cards && Array.isArray(view.cards)) {
        this._viewContentEl.classList.add('view-content--direct');
        this._logToHA('debug', `view has ${view.cards.length} direct cards`);
        for (let i = 0; i < view.cards.length; i++) {
          const cardConfig = view.cards[i];
          this._logToHA('debug', `rendering direct card ${i}: ${cardConfig.type || 'unknown'}`);
          const success = await this._renderCard(cardConfig, this._viewContentEl);
          if (success) {
            cardCount++;
          }
        }
      } else {
        this._logToHA('warning', `view has no cards or sections`);
      }

      this._logToHA('debug', `completed rendering view ${this._currentViewIndex}: ${cardCount} cards rendered`);
    } catch (err) {
      this._logToHA('error', `failed to render view: ${err.message || String(err)}`);
      console.error('pulse-photo-card: view rendering error', err);
      // Don't reset to photo on error, just log it
    } finally {
      if (this._viewContentEl) {
        this._logToHA('debug', `view content now has ${this._viewContentEl.children.length} child nodes`);
      }
      this._showView();
      this._viewHasContent = (this._renderedCards?.length || 0) > 0;
      if (this._viewHasContent) {
        this._clearViewRenderRetry();
        this._updateNavigationButtons();
      } else {
        this._logToHA('debug', 'view rendered but no cards attached; scheduling retry');
        this._scheduleViewRenderRetry();
      }
      this._isRenderingView = false;
    }
  }

  async _renderCard(cardConfig, targetContainer = null) {
    if (!cardConfig || !this._cardHelpers) {
      this._logToHA('warning', `cannot render card: missing config or helpers`);
      return;
    }

    const hostContainer = targetContainer || this._viewContentEl;
    if (!hostContainer) {
      this._logToHA('warning', 'cannot render card: missing host container');
      return;
    }

    const cardType = cardConfig.type || 'unknown';
    this._logToHA('debug', `attempting to render card: ${cardType}`);

    try {
      // Handle nested cards (like horizontal-stack, vertical-stack, etc.)
      if (cardConfig.cards && Array.isArray(cardConfig.cards)) {
        // This is a container card with nested cards
        this._logToHA('debug', `rendering container card: ${cardType} with ${cardConfig.cards.length} nested cards`);
        const containerCard = await this._cardHelpers.createCardElement(cardConfig);
        if (containerCard) {
          containerCard.setAttribute('data-view-card', 'true');
          // Append to DOM first, then set hass (some cards need to be in DOM first)
          hostContainer.appendChild(containerCard);
          this._renderedCards.push(containerCard);
          this._viewHasContent = true;
          this._updateNavigationButtons();
          this._clearViewRenderRetry();

          // Wait for next frame to ensure card is in DOM
          await new Promise(resolve => requestAnimationFrame(resolve));

          // Now set hass - this is critical for nested cards to render
          if (this._hass) {
            containerCard.hass = this._hass;
          }

          // Force multiple hass updates to ensure nested cards render
          // Container cards often need multiple updates to render their nested cards
          const updateHass = () => {
            if (containerCard && this._hass) {
              containerCard.hass = this._hass;
            }
          };
          setTimeout(updateHass, 50);
          setTimeout(updateHass, 100);
          setTimeout(updateHass, 200);
          setTimeout(updateHass, 500);
          setTimeout(updateHass, 1000);

          // Also try to trigger a config update if the card supports it
          setTimeout(() => {
            if (containerCard && containerCard.setConfig && typeof containerCard.setConfig === 'function') {
              try {
                containerCard.setConfig(cardConfig);
                if (this._hass) {
                  containerCard.hass = this._hass;
                }
              } catch (e) {
                // Ignore config errors
              }
            }
          }, 300);

          this._logToHA('debug', `rendered container card: ${cardType} with ${cardConfig.cards?.length || 0} nested cards`);
        } else {
          this._logToHA('warning', `container card creation returned null for type: ${cardType}`);
        }
      } else {
        // Regular card
        const card = await this._cardHelpers.createCardElement(cardConfig);
        if (card) {
          card.setAttribute('data-view-card', 'true');
          // Set hass before appending to ensure card initializes properly
          if (this._hass) {
            card.hass = this._hass;
          }
          hostContainer.appendChild(card);
          this._renderedCards.push(card);
          this._viewHasContent = true;
          this._updateNavigationButtons();
          this._clearViewRenderRetry();
          // Ensure hass is set after appending (some cards need it after DOM attachment)
          if (this._hass && card.hass !== this._hass) {
            card.hass = this._hass;
          }
          // Force multiple hass updates for custom cards that might need it
          setTimeout(() => {
            if (card && this._hass) {
              card.hass = this._hass;
            }
          }, 50);
          setTimeout(() => {
            if (card && this._hass) {
              card.hass = this._hass;
            }
          }, 200);
          this._logToHA('debug', `rendered card: ${cardType}`);
        } else {
          this._logToHA('warning', `card creation returned null for type: ${cardType}`);
        }
      }
    } catch (err) {
      this._logToHA('error', `failed to render card ${cardType}: ${err.message || String(err)}`);
      console.error('pulse-photo-card: card rendering error', err, cardConfig);
    }
  }

  _showView() {
    if (this._viewContainerEl) {
      this._viewTransitioning = true;
      if (this._viewTransitionTimer) {
        clearTimeout(this._viewTransitionTimer);
        this._viewTransitionTimer = null;
      }
      // Remove hidden first to make container visible (even if opacity is 0)
      this._viewContainerEl.classList.remove('hidden');
      // Force reflow to ensure background is rendered
      this._viewContainerEl.offsetHeight;
      // Now add visible class to start fade-in transition
      // Use requestAnimationFrame to ensure the background is painted first
      requestAnimationFrame(() => {
        if (this._viewContainerEl) {
          this._viewContainerEl.classList.add('visible');
          this._logToHA('debug', 'view container shown (visible class applied)');
        }
      });
      const fadeMs = this._config?.fade_ms || 500;
      this._viewTransitionTimer = setTimeout(() => {
        this._viewTransitioning = false;
        this._viewTransitionTimer = null;
        this._updateNavigationButtons();
      }, fadeMs);
    }
  }

  _hideView() {
    if (this._viewContainerEl) {
      this._viewTransitioning = true;
      if (this._viewTransitionTimer) {
        clearTimeout(this._viewTransitionTimer);
        this._viewTransitionTimer = null;
      }
      this._viewContainerEl.classList.remove('visible');
      // Wait for transition to complete before hiding
      const fadeMs = this._config?.fade_ms || 500;
      this._viewTransitionTimer = setTimeout(() => {
        if (this._viewContainerEl) {
          this._viewContainerEl.classList.add('hidden');
        }
        this._viewTransitioning = false;
        this._viewTransitionTimer = null;
        this._updateNavigationButtons();
      }, fadeMs);
    }
  }

  _debugState() {
    return {
      currentViewIndex: this._currentViewIndex,
      viewsConfigured: this._views?.length || 0,
      renderedCards: this._renderedCards?.length || 0,
      viewContentChildren: this._viewContentEl?.children?.length || 0,
      viewContainerClasses: this._viewContainerEl ? [...this._viewContainerEl.classList] : [],
      viewContentClasses: this._viewContentEl ? [...this._viewContentEl.classList] : [],
      navButtonsVisible: this._navButtonsEl ? !this._navButtonsEl.classList.contains('hidden') : null,
      clickThroughLayerActive: this._clickThroughLayer?.classList.contains('active') || false,
      overlayIframeVisible: this._remoteOverlayEl ? !this._remoteOverlayEl.classList.contains('hidden') : null,
      timeoutSeconds: this._viewTimeoutSeconds,
      hasActiveTimeout: Boolean(this._viewTimeoutTimer),
      lastLog: new Date().toISOString(),
    };
  }

  // ============================================================================
  // View Rendering Utilities & Helpers
  // ============================================================================
  _cleanupRenderedCards() {
    if (this._renderedCards && this._renderedCards.length > 0) {
      this._renderedCards.forEach(card => {
        if (card && card.parentNode) {
          card.parentNode.removeChild(card);
        }
      });
      this._renderedCards = [];
    }
  }

  _collectCustomCardTags(view) {
    const tags = new Set();
    const processCard = (card) => {
      if (!card || typeof card !== 'object') {
        return;
      }
      const type = (card.type || '').toString().toLowerCase();
      if (type.startsWith('custom:')) {
        const tag = type.split(':')[1]?.trim();
        if (tag) {
          tags.add(tag);
        }
      }
      if (Array.isArray(card.cards)) {
        card.cards.forEach(processCard);
      }
      if (Array.isArray(card.entities)) {
        card.entities.forEach(entity => {
          if (entity && typeof entity === 'object') {
            processCard(entity);
          }
        });
      }
      if (card.card && typeof card.card === 'object') {
        processCard(card.card);
      }
    };

    if (view.sections && Array.isArray(view.sections)) {
      for (const section of view.sections) {
        if (section?.cards && Array.isArray(section.cards)) {
          section.cards.forEach(processCard);
        }
      }
    }

    if (view.cards && Array.isArray(view.cards)) {
      view.cards.forEach(processCard);
    }

    return tags;
  }

  async _waitForCustomCardDefinitions(tags, timeoutMs = 4000) {
    const waits = [...tags].map(tag => {
      if (!tag || typeof tag !== 'string') {
        return Promise.resolve();
      }
      if (customElements.get(tag)) {
        return Promise.resolve();
      }
      return new Promise(resolve => {
        let finished = false;
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            this._logToHA('debug', `timed out waiting for custom card ${tag}`);
            resolve();
          }
        }, timeoutMs);
        customElements.whenDefined(tag).then(() => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            this._logToHA('debug', `custom card ${tag} defined`);
            resolve();
          }
        }).catch(() => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            resolve();
          }
        });
      });
    });
    await Promise.all(waits);
  }

  _scheduleViewRenderRetry(reason = 'no content rendered', delayMs = 800) {
    if (this._currentViewIndex < 0) {
      return;
    }
    this._clearViewRenderRetry();
    this._logToHA('debug', `scheduling view render retry (${reason}) in ${delayMs}ms`);
    this._pendingViewRenderRetry = setTimeout(() => {
      this._pendingViewRenderRetry = null;
      if (this._currentViewIndex >= 0 && !this._viewHasContent) {
      this._logToHA('debug', 'retrying view render after missing content');
        this._renderCurrentView();
      }
    }, delayMs);
  }

  _clearViewRenderRetry() {
    if (this._pendingViewRenderRetry) {
      clearTimeout(this._pendingViewRenderRetry);
      this._pendingViewRenderRetry = null;
    }
  }

  async _tryRenderWithNativeView(viewConfig) {
    if (!this._config?.experimental_native_views) {
      return false;
    }
    if (!viewConfig || !this._viewContentEl) {
      return false;
    }

    const candidateTags = this._getViewElementTags(viewConfig);
    if (!candidateTags.length) {
      return false;
    }

    const lovelace = this._getLovelaceContext();

    for (const tag of candidateTags) {
      if (!customElements.get(tag)) {
        continue;
      }
      let viewElement = null;
      try {
        viewElement = document.createElement(tag);
        viewElement.classList.add('embedded-ha-view');
        if (lovelace) {
          viewElement.lovelace = lovelace;
        }
        if (typeof viewElement.setConfig === 'function') {
          await viewElement.setConfig(viewConfig);
        } else if ('config' in viewElement) {
          viewElement.config = viewConfig;
        }
        if (this._hass) {
          viewElement.hass = this._hass;
        }
        if ('isPanel' in viewElement) {
          viewElement.isPanel = true;
        }
        if ('narrow' in viewElement) {
          viewElement.narrow = false;
        }
        this._viewContentEl.appendChild(viewElement);
        this._renderedCards.push(viewElement);
        this._logToHA('debug', `rendered native HA view using ${tag}`);
        return true;
      } catch (err) {
        this._logToHA('warning', `failed to render native view via ${tag}: ${err?.message || err}`);
        if (viewElement && viewElement.parentNode) {
          viewElement.parentNode.removeChild(viewElement);
        }
      }
    }
    return false;
  }

  _getViewElementTags(viewConfig) {
    const tags = [];
    if (!viewConfig) {
      return ['hui-view'];
    }
    const type = (viewConfig.type || '').toLowerCase();
    if (viewConfig.panel) {
      tags.push('hui-panel-view');
    }
    if (type === 'sections') {
      tags.push('hui-sections-view');
    } else if (type === 'sidebar') {
      tags.push('hui-sidebar-view');
    } else if (type === 'grid') {
      tags.push('hui-grid-view');
    } else if (type === 'masonry') {
      tags.push('hui-masonry-view');
    }
    tags.push('hui-view');
    return [...new Set(tags)];
  }

  _getLovelaceContext() {
    if (this._lovelaceContext) {
      return this._lovelaceContext;
    }

    // Try to locate lovelace context from host tree
    let root = this;
    while (root) {
      if (root.lovelace) {
        this._lovelaceContext = root.lovelace;
        return this._lovelaceContext;
      }
      if (root.parentElement) {
        root = root.parentElement;
        continue;
      }
      const node = root.getRootNode && root.getRootNode();
      root = node && node.host ? node.host : null;
    }

    // Fallback: query the main Home Assistant app shell
    const ha = document.querySelector('home-assistant');
    const main = ha?.shadowRoot?.querySelector('home-assistant-main');
    const drawer = main?.shadowRoot?.querySelector('app-drawer-layout');
    const panelResolver = drawer?.querySelector('partial-panel-resolver') || main?.shadowRoot?.querySelector('partial-panel-resolver');
    const panel = panelResolver?.shadowRoot?.querySelector('ha-panel-lovelace');
    const huiRoot = panel?.shadowRoot?.querySelector('hui-root');
    if (huiRoot?.lovelace) {
      this._lovelaceContext = huiRoot.lovelace;
      return this._lovelaceContext;
    }

    // Ultimate fallback: try global reference if available
    if (window.lovelace?.config) {
      this._lovelaceContext = window.lovelace;
      return this._lovelaceContext;
    }

    return null;
  }

  _startViewTimeout() {
    this._clearViewTimeout();
    // Only start timeout if we're actually on a view (not photo)
    if (this._currentViewIndex >= 0 && this._viewTimeoutSeconds > 0) {
      const timeoutMs = this._viewTimeoutSeconds * 1000;
      this._logToHA('debug', `starting view timeout: ${this._viewTimeoutSeconds}s for view ${this._currentViewIndex}`);
      this._viewTimeoutTimer = setTimeout(() => {
        // Double-check we're still on a view before returning to photo
        if (this._currentViewIndex >= 0) {
          this._logToHA('debug', `view timeout reached for view ${this._currentViewIndex}, returning to photo`);
          this._goToPhoto();
        }
      }, timeoutMs);
    }
  }

  _clearViewTimeout() {
    if (this._viewTimeoutTimer) {
      clearTimeout(this._viewTimeoutTimer);
      this._viewTimeoutTimer = null;
    }
  }

  _handleOverlayMessage(e) {
    if (!e || !e.data) {
      return;
    }
    // Only handle messages originating from the overlay iframe
    if (!this._remoteOverlayFrame || e.source !== this._remoteOverlayFrame.contentWindow) {
      return;
    }
    const data = typeof e.data === 'object' ? e.data : {};
    if (data.type === 'pulse-photo-card-click-bridge') {
      if (data.status === 'ready') {
        this._overlayClickBridgeReady = true;
        this._cancelOverlayClickBridgeFallback();
        this._overlayClickBridgeFallbackEnabled = false;
        this._updateClickThroughLayer();
      }
      return;
    }
    // The overlay can send { type: 'pulse-photo-card-click', handled: false } when a click wasn't handled
    if (data.type === 'pulse-photo-card-click' && data.handled === false) {
      // Only handle if we're on photo screen
      if (this._currentViewIndex === -1 && this._views && this._views.length > 0) {
        this._logToHA('debug', "overlay forwarded unhandled click, navigating to first view");
        this._goToView(0);
      }
    }
  }

}

if (!customElements.get('pulse-photo-card')) {
  customElements.define('pulse-photo-card', PulsePhotoCard);
}

