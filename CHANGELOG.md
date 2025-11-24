## [0.18.6](https://github.com/weirdtangent/pulse-photo-card/compare/v0.18.5...v0.18.6) (2025-11-24)


### Bug Fixes

* add .local to PULSE_HOST if it doesn't already include a domain name; .local is where HA assumes itself to be ([67704bb](https://github.com/weirdtangent/pulse-photo-card/commit/67704bb6b40e869d56813947f6aed3e899bdd969))

## [0.18.5](https://github.com/weirdtangent/pulse-photo-card/compare/v0.18.4...v0.18.5) (2025-11-23)


### Bug Fixes

* and now fix the z-index of the overlay itself ([456b045](https://github.com/weirdtangent/pulse-photo-card/commit/456b045027f7ad69e247bdf77252568168790887))

## [0.18.4](https://github.com/weirdtangent/pulse-photo-card/compare/v0.18.3...v0.18.4) (2025-11-23)


### Bug Fixes

* fix z-image for images ([ed9ba82](https://github.com/weirdtangent/pulse-photo-card/commit/ed9ba82267faa0e38e7b8eda15a620c7f5a482a9))

## [0.18.3](https://github.com/weirdtangent/pulse-photo-card/compare/v0.18.2...v0.18.3) (2025-11-23)


### Bug Fixes

* it wasn't OUR pop-up, it was from HA and/or MA ([554e7df](https://github.com/weirdtangent/pulse-photo-card/commit/554e7df0299b98488e9d0ebe789f1f408335b83e))

## [0.18.2](https://github.com/weirdtangent/pulse-photo-card/compare/v0.18.1...v0.18.2) (2025-11-23)


### Bug Fixes

* getting more aggressive to hide that 2nd phantom NowPlaying box ([74ce6e4](https://github.com/weirdtangent/pulse-photo-card/commit/74ce6e43715a00029eb4323944dc0dc0ed977bd5))

## [0.18.1](https://github.com/weirdtangent/pulse-photo-card/compare/v0.18.0...v0.18.1) (2025-11-23)


### Bug Fixes

* more effort to hide legacy NowPlaying if live /overlay loaded ([cc1ef26](https://github.com/weirdtangent/pulse-photo-card/commit/cc1ef26a4f6ec03cb79737e97eb759990bc1816f))

# [0.18.0](https://github.com/weirdtangent/pulse-photo-card/compare/v0.17.0...v0.18.0) (2025-11-23)


### Features

* added error logs for debugging help ([599d388](https://github.com/weirdtangent/pulse-photo-card/commit/599d3887edad51f50256e55a1ec8ba17ad4da14a))

# [0.17.0](https://github.com/weirdtangent/pulse-photo-card/compare/v0.16.1...v0.17.0) (2025-11-23)


### Features

* log error to HA if PulseOS overlay fails to load ([3529a6c](https://github.com/weirdtangent/pulse-photo-card/commit/3529a6cc4249b7b866c0e674d9afabfb762286c9))

## [0.16.1](https://github.com/weirdtangent/pulse-photo-card/compare/v0.16.0...v0.16.1) (2025-11-23)


### Bug Fixes

* switch to display: none for the hidden overlay ([0f60438](https://github.com/weirdtangent/pulse-photo-card/commit/0f6043843877e1f45ac8f83e3ddac443511fc20b))

# [0.16.0](https://github.com/weirdtangent/pulse-photo-card/compare/v0.15.3...v0.16.0) (2025-11-23)


### Features

* default overlay_refresh_entity to 'auto' ([85e5ec7](https://github.com/weirdtangent/pulse-photo-card/commit/85e5ec755c42e55a67b0eabc2256127d0927d8e5))

## [0.15.3](https://github.com/weirdtangent/pulse-photo-card/compare/v0.15.2...v0.15.3) (2025-11-23)


### Bug Fixes

* do HTML codes work, since emojis do not ([87a38d0](https://github.com/weirdtangent/pulse-photo-card/commit/87a38d045053b65baa11b7aef0f8c6f21d252001))

## [0.15.2](https://github.com/weirdtangent/pulse-photo-card/compare/v0.15.1...v0.15.2) (2025-11-23)


### Bug Fixes

* assume hostname is on .local for DNS resolution ([bccf17a](https://github.com/weirdtangent/pulse-photo-card/commit/bccf17a29d399f2d06bf5bc1b3f02d0373767a90))

## [0.15.1](https://github.com/weirdtangent/pulse-photo-card/compare/v0.15.0...v0.15.1) (2025-11-22)


### Bug Fixes

* add allowtransparency to iframe ([3616ce1](https://github.com/weirdtangent/pulse-photo-card/commit/3616ce1ede9502b16c757c7fca5b9aedab5eb417))

# [0.15.0](https://github.com/weirdtangent/pulse-photo-card/compare/v0.14.0...v0.15.0) (2025-11-22)


### Features

* add PulseOS overlay embed support ([0a126dc](https://github.com/weirdtangent/pulse-photo-card/commit/0a126dc0991b3db060dcd242f9d2f500538a01a4))

# [0.15.0](https://github.com/weirdtangent/pulse-photo-card/compare/v0.14.0...v0.15.0) (2025-11-22)

### Features

* embed the PulseOS `/overlay` endpoint inside the card, auto-refreshing via MQTT hints and falling back to the legacy clock ([TBD](https://github.com/weirdtangent/pulse-photo-card/compare/v0.14.0...v0.15.0))

### Docs

* document overlay config knobs and setup flow in README/info
