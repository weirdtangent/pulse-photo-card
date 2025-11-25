# Pulse Photo Card

<p align="center">
  <img src="https://raw.githubusercontent.com/weirdtangent/pulse-photo-card/main/assets/logo.png" alt="Pulse OS social preview" width="640" />
</p>

A full-screen photo frame card for Home Assistant with smooth crossfades and clock overlay. Integration with [PulseOS](https://github.com/weirdtangent/pulse-os) adds live overlay, timers, and more.

## Features

- **Smooth crossfades** - Double-buffered image transitions with no white flash
- **Clock overlay** - Displays current time and date with automatic locale/timezone support
- **Now Playing badge** - Optional artist/title ribbon powered by any HA entity
- **Media source support** - Works with Home Assistant's media browser and signed URLs
- **Navigation cycling** - Optional tap-to-cycle through multiple dashboards (perfect for kiosks)
- **[PulseOS](https://github.com/weirdtangent/pulse-os) overlay embed** - Automatically mirrors the kiosk-hosted overlay (multiple clocks, timers, alarms, notification bar, buttons) and falls back to the built-in clock if unreachable
- **Responsive design** - Adapts to any screen size with responsive typography

## Preview

I used `?disable_km` in order to turn off kiosk mode so I could show a preview, but the card is best when paired with Kiosk Mode, so it ONLY shows a single photo—perfect as a photo library and burn-in preventer when your kiosk is idle.

<p align="center">
  <img src="https://raw.githubusercontent.com/weirdtangent/pulse-photo-card/main/assets/sample.png" alt="Pulse Photo Card sample" width="640" />
</p>

## Why the card stands on its own

Even without [PulseOS](https://github.com/weirdtangent/pulse-os), this card gives you a smooth, full-screen slideshow: crossfades between
signed media-source URLs, an optional customizable clock/Now Playing badge, and a tap handler
that can rotate through multiple dashboards via `secondary_urls`. Hook it up to any sensor that
exposes a JPEG/PNG path or `media-source://` URL, and you instantly have a polished photo frame
dashboard that keeps burning in at bay.

You still get:

- automatic fade transitions (`fade_ms`)
- a badge that follows `media_title`/`media_artist` from any HA entity
- navigation cycling across dashboards on tap
- the embedded clock/overlay when the kiosk integration isn’t available

Use the helper sensors below to control image selection, then point the card at `sensor.pulse_current_photo_url`
for a turnkey slideshow experience.


## Installation

### Via HACS (Recommended)

1. In Home Assistant, go to **HACS → Frontend** → **+ Explore & Download Repositories**
2. Search for "Pulse Photo Card" or add this repository as a custom repository:
   - Repository: `https://github.com/weirdtangent/pulse-photo-card`
   - Category: `Plugin` (Lovelace card)
3. Click **Download** and restart Home Assistant
4. The card will be automatically registered as a resource

### Manual Installation

1. Download `pulse-photo-card.js` from this repository
2. Copy it to your Home Assistant `config/www/` directory
3. In Home Assistant, go to **Settings → Dashboards → ⋮ → Resources → + Add Resource**:
   - URL: `/local/pulse-photo-card.js?v=1`
   - Resource type: `JavaScript Module`
4. Enable Advanced Mode in your HA profile (needed for the Resources menu if it's hidden)

## Setup

### 1. Create Helper Sensors

Add these to your `configuration.yaml` to randomly select photos from your HA media source:

```yaml
command_line:
  - sensor:
      name: Pulse Current Photo
      command: >
        find /media/Photos/Favorites -type f \( -iname '*.jpg' -o -iname '*.png' \) |
        shuf -n 1
      scan_interval: 60  # rotate new photo every 60 seconds, or change that timing here

template:
  - sensor:
      - name: Pulse Current Photo URL
        state: >
          {% set f = states('sensor.pulse_current_photo') %}
          {{ 'media-source://media_source/local' + f[6:] if f.startswith('/media') else f }}
```

- `scan_interval` controls how often the slideshow advances (seconds)
- Adjust the path `/media/Photos/Favorites` to match your photo location
- Use HA Settings | System | Storage to mount your photo library from your network
- The template converts file paths into `media-source://` URLs for authenticated access

### 2. Create the Dashboard View

Create a panel view that uses the custom card and your rotating photo URL sensor:

```yaml
views:
  - title: Pulse Photo Frame
    path: photo-frame
    panel: true
    theme: midnight
    cards:
      - type: custom:pulse-photo-card
        entity: sensor.pulse_current_photo_url
        fade_ms: 2000              # optional, default 1000
        now_playing_entity: auto   # optional; follows sensor.<pulse_host>_now_playing
        secondary_urls:            # optional, array of URLs to cycle through on tap
          - /pulse-house
          - /pulse-security
```

Point `now_playing_entity` at any Home Assistant entity that exposes `media_title` / `media_artist` attributes (for example, Music Assistant or Snapcast `media_player` entities). You can also supply a sensor that already formats the text (the badge will show the sensor state whenever it isn't `unknown`/`unavailable`). Leave the option out entirely if you don't want a Now Playing pill.

Running a shared dashboard across multiple kiosks? Set `now_playing_entity: auto` and make sure each Pulse device appends `?pulse_host=<hostname>` ([PulseOS](https://github.com/weirdtangent/pulse-os) adds this automatically, see below). The card will look up `sensor.<pulse_host>_now_playing`, so every kiosk shows its own track without duplicating Lovelace YAML.

## [PulseOS](https://github.com/weirdtangent/pulse-os) integration (optional)

[PulseOS](https://github.com/weirdtangent/pulse-os) is aimed at makers building a desktop kiosk or assistant with a Pi 5 and Pi Touch 7" Display. Pairing this card with [PulseOS](https://github.com/weirdtangent/pulse-os) turns it into a fully synced kiosk sidecar: you still get the
standalone slideshow above, plus live overlay HTML, timers, alarms, notification badges, and
button hooks that match what [PulseOS](https://github.com/weirdtangent/pulse-os) is already showing. If you don’t run [PulseOS](https://github.com/weirdtangent/pulse-os), you can
skip this section and keep using the card as-is.

### DNS resolution for `PULSE_HOST`

When you do run [PulseOS](https://github.com/weirdtangent/pulse-os) dashboards, Home Assistant must resolve the hostname that the kiosk
passes via `?pulse_host=<hostname>` or the `PULSE_HOST` environment variable. Without that,
the overlay iframe and `sensor.<pulse_host>_now_playing` auto-detection break, even if the
kiosk itself can reach the host.

Make sure you:

- Add a proper DNS record (e.g., via your router, Pi-hole, AdGuard, or internal DNS)
- Or add a hosts entry on the HA host/container
- Or rely on mDNS/`.local` resolution—**the card now automatically tries `<pulse_host>.local` when the kiosk reports a bare hostname**
- Or set `PULSE_HOST` to an IP address instead of a hostname (less ideal, but works)

Once HA can resolve `PULSE_HOST` (or `<pulse_host>.local`), the overlay iframe and auto-entity features work reliably.

**Quick test:** open the Home Assistant Terminal & SSH add-on (or exec into the HA container/VM) and run `ping <pulse_host>` and `ping <pulse_host>.local`. If both fail to resolve, fix DNS/hosts or enable mDNS before continuing.

### Overlay endpoint integration

[PulseOS](https://github.com/weirdtangent/pulse-os) 0.12+ exposes `http://<pulse-host>:8800/overlay` and an MQTT hint topic `pulse/<host>/overlay/refresh`. The card can embed that ready-made HTML in an `<iframe>` so timers, alarms, multi-clock layouts, notification badges, and Stop/Snooze buttons stay in perfect sync with the kiosk without reimplementing them in JavaScript.

1. Ensure your kiosk URL already includes `?pulse_host=<hostname>` ([PulseOS](https://github.com/weirdtangent/pulse-os) does this automatically). The card maps that hostname to `http://<host>:8800/overlay`, automatically appending `.local` when the host lacks a domain.
2. Create an MQTT sensor (or any HA entity) that mirrors `pulse/<host>/overlay/refresh` and name it `sensor.<pulse_host>_overlay_refresh` (e.g., `sensor.pulse_living_room_overlay_refresh`). The card auto-detects that entity when `overlay_refresh_entity` is unset or `"auto"`. Each JSON payload change re-fetches the overlay HTML. Example:

   ```yaml
   mqtt:
     sensor:
       - name: "Pulse Living Overlay Refresh"
         state_topic: "pulse/living-room/overlay/refresh"
         value_template: "{{ value_json.version }}"
   ```

3. Optionally tighten `overlay_poll_seconds` (default 120) for quicker safety refreshes.

If the overlay endpoint can’t be reached, the card automatically falls back to the built-in clock overlay so users still see the time.

### Kiosk-mode dashboards

[PulseOS](https://github.com/weirdtangent/pulse-os) pairs nicely with HACS kiosk-mode (`/hacs/repository/497319128`), so the dashboard can stay truly fullscreen. Add a few kiosk-mode flags above your view YAML:

```yaml
kiosk_mode:

  hide_header: true

  hide_sidebar: true

  force: true

views:

  - title: Pulse Photo Frame

    path: photo

    panel: true

    theme: midnight

    cards:

      - type: custom:pulse-photo-card

        entity: sensor.pulse_current_photo_url

        fade_ms: 2000

        overlay_refresh_entity: auto

        now_playing_entity: auto

        secondary_urls:

          - /pulse-house

          - /pulse-security
```

Point `PULSE_URL` at the kiosk view (e.g., `http://homeassistant.local:8123/pulse-home?sidebar=hide`). [PulseOS](https://github.com/weirdtangent/pulse-os) already adds `?pulse_host=<hostname>` when launching dashboards, so each kiosk keeps its own overlay and Now Playing badge. Append `?disable_km` to the URL while configuring if you need to expose the Lovelace edit/UI buttons again.
## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **required** | Sensor entity that provides the image URL |
| `fade_ms` | number | `1000` | Cross-fade transition duration in milliseconds |
| `now_playing_entity` | string | `null` | Optional `media_player`/sensor entity for the badge. Set to `"auto"` to follow `sensor.<pulse_host>_now_playing`. |
| `now_playing_label` | string | `"Now Playing"` | Overrides the label shown above the track text |
| `secondary_urls` | array | `[]` | Array of navigation paths to cycle through on tap |
| `overlay_enabled` | bool | auto | Set to `false` to force the legacy overlay even if a kiosk overlay is available. Defaults to `true` when `overlay_url` resolves. |
| `overlay_url` | string | `http://<pulse_host>:8800/overlay` | URL of the [PulseOS](https://github.com/weirdtangent/pulse-os) overlay endpoint. Leave unset to auto-detect via `?pulse_host` (the card auto-appends `.local` when the hostname lacks a domain). |
| `overlay_refresh_entity` | string | `auto` | Optional HA entity (e.g., MQTT sensor) whose state changes when the kiosk publishes overlay refresh hints. Leave unset/`"auto"` to follow `sensor.<pulse_host>_overlay_refresh`; set a custom entity if you use a different naming pattern. |
| `overlay_poll_seconds` | number | `120` | Fallback refresh cadence (seconds) if no refresh entity is configured or events are missed. Set to `0` to disable polling entirely. |

### Overlay endpoint integration

[PulseOS](https://github.com/weirdtangent/pulse-os) 0.12+ exposes a ready-to-render overlay at `http://<pulse-host>:8800/overlay` plus an MQTT hint topic `pulse/<host>/overlay/refresh`. The card can now embed that HTML in an `<iframe>` so timers, alarms, multi-clock layouts, notification badges, and Stop/Snooze buttons stay in perfect sync with the kiosk without reimplementing them in JavaScript. When a kiosk only reports a bare hostname (no dots), the card automatically tries the `.local` mDNS suffix so Home Assistant can still reach it.

Recommended setup:

1. Ensure your kiosk URL already includes `?pulse_host=<hostname>` on the dashboard URL ([PulseOS](https://github.com/weirdtangent/pulse-os) does this automatically). The card will map that hostname to `http://<host>:8800/overlay`, automatically appending `.local` whenever the host lacks a domain segment.
2. Create an MQTT sensor (or any HA entity) that mirrors `pulse/<host>/overlay/refresh` and name it `sensor.<pulse_host>_overlay_refresh` (for example, `sensor.pulse_living_room_overlay_refresh`). The card auto-detects that entity whenever `overlay_refresh_entity` is unset or `"auto"`. Each time the JSON payload changes, the card re-fetches the overlay HTML. Example:

   ```yaml
   mqtt:
     sensor:
       - name: "Pulse Living Overlay Refresh"
         state_topic: "pulse/living-room/overlay/refresh"
         value_template: "{{ value_json.version }}"
   ```

3. Optionally tighten `overlay_poll_seconds` (default 120) if you want a quicker safety refresh.

If the overlay endpoint can't be reached, the card automatically falls back to its legacy overlay so users still see the time.

### Navigation Cycling

When `secondary_urls` is configured, tapping anywhere on **any dashboard** (not just the photo frame) cycles through these URLs and back to the home screen. Each tap advances to the next URL in the array, wrapping back to home after the last one.

**Note:** The global tap handler intelligently skips interactive elements (buttons, links, inputs, etc.) so it won't interfere with normal dashboard interactions. It only handles taps on empty areas of the dashboard.

This feature is particularly useful for kiosk displays where you want simple tap navigation between multiple dashboards.

## Troubleshooting

- **Black screen** → The helper returned a path HA can't serve. Verify `sensor.pulse_current_photo_url` looks like `media-source://media_source/local/...`.
- **Overlay iframe missing / Now Playing auto entity unavailable** → Home Assistant can't resolve your `PULSE_HOST`. Add a DNS/hosts entry or use an IP so the HA host can reach the overlay endpoint (the card already tries `<pulse_host>.local` when no domain is provided).
- **401 Unauthorized in console** → You're hitting `/local/...` or added your own query parameters. Let the card resolve the media-source path; don't append cache busters, the signed `authSig` already handles caching.
- **Still using old JS** → Bump the resource version (`/local/pulse-photo-card.js?v=2`) or use Advanced Mode → Resources → Reload.
- **Clock not updating** → Hard-refresh the dashboard (Cmd/Ctrl + Shift + R) after saving to ensure the browser loads the latest card code.

## Customization

The card CSS lives at the top of `pulse-photo-card.js`. You can customize:
- Fonts and typography
- Overlay gradients
- Clock positioning
- Add weather widgets or other overlays

## Related Projects

This card was originally created for [Pulse OS](https://github.com/weirdtangent/pulse-os), a Raspberry Pi kiosk setup for Home Assistant. While it works great with Pulse devices, it's a standalone card that works with any Home Assistant installation.

## License

MIT License - see [LICENSE](LICENSE) file for details.

