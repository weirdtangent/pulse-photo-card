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
