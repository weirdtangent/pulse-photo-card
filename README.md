# Pulse Photo Card

<p align="center">
  <img src="https://raw.githubusercontent.com/weirdtangent/pulse-photo-card/main/assets/logo.png" alt="Pulse OS social preview" width="640" />
</p>

A beautiful, full-screen photo frame card for Home Assistant with smooth crossfades, clock overlay, optional navigation cycling, and first-class integration with the new PulseOS overlay endpoint.

## Features

- **Smooth crossfades** - Double-buffered image transitions with no white flash
- **Clock overlay** - Displays current time and date with automatic locale/timezone support
- **Now Playing badge** - Optional artist/title ribbon powered by any HA entity
- **Media source support** - Works with Home Assistant's media browser and signed URLs
- **Navigation cycling** - Optional tap-to-cycle through multiple dashboards (perfect for kiosks)
- **PulseOS overlay embed** - Automatically mirrors the kiosk-hosted overlay (multiple clocks, timers, alarms, notification bar, buttons) and falls back to the built-in clock if unreachable
- **Responsive design** - Adapts to any screen size with responsive typography

## Preview

I used ?disable_km to turn off Kiosk mode so I could show a preview. But, the idea of this card is
to ONLY show a picture, suitable as a photo library and burn-in preventer for your kiosk device
when not in use.

<p align="center">
  <img src="https://raw.githubusercontent.com/weirdtangent/pulse-photo-card/main/assets/sample.png" alt="Pulse Photo Card sample" width="640" />
</p>


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

## Prerequisite: DNS resolution for `PULSE_HOST`

The card talks to PulseOS via Home Assistant, so your Home Assistant instance (container, VM, or bare metal host) must be able to resolve the same hostname that your kiosks send as `?pulse_host=<hostname>` / `PULSE_HOST`. If Home Assistant can't resolve that hostname to an IP address, the overlay iframe and the `sensor.<pulse_host>_now_playing` auto-detection will fail, even if the kiosk itself can reach PulseOS.

Make sure you:

- Add a proper DNS record (e.g., via your router, Pi-hole, AdGuard, or internal DNS)
- Or add a hosts entry on the machine/container running Home Assistant
- Or set `PULSE_HOST` to an IP address instead of a hostname (less ideal, but works)

Once Home Assistant can resolve `PULSE_HOST`, the overlay and auto-entity features work reliably.

**Quick test:** open the Home Assistant Terminal & SSH add-on (or exec into the HA container/VM) and run `ping <pulse_host>`. If the ping fails to resolve, fix DNS/hosts before continuing.

## Setup

### 1. Create Helper Sensors

Add these to your `configuration.yaml` to randomly select photos:

```yaml
command_line:
  - sensor:
      name: Pulse Current Photo
      command: >
        find /media/Photos/Favorites -type f \( -iname '*.jpg' -o -iname '*.png' \) |
        shuf -n 1
      scan_interval: 60

template:
  - sensor:
      - name: Pulse Current Photo URL
        state: >
          {% set f = states('sensor.pulse_current_photo') %}
          {{ 'media-source://media_source/local' + f[6:] if f.startswith('/media') else f }}
```

- `scan_interval` controls how often the slideshow advances (seconds)
- Adjust the path `/media/Photos/Favorites` to match your photo location
- The template converts file paths into `media-source://` URLs for authenticated access

### 2. Create the Dashboard View

Create a panel view that uses the custom card:

```yaml
views:
  - title: Pulse Photo Frame
    path: photo-frame
    panel: true
    theme: midnight
    cards:
      - type: custom:pulse-photo-card
        entity: sensor.pulse_current_photo_url
        fade_ms: 1200          # optional, default 1000
        now_playing_entity: auto   # optional; follows sensor.<pulse_host>_now_playing
        secondary_urls:        # optional, array of URLs to cycle through on tap
          - /dashboard-pulse/0
          - /dashboard-weather
```

Point `now_playing_entity` at any Home Assistant entity that exposes `media_title` / `media_artist` attributes (for example, Music Assistant or Snapcast `media_player` entities). You can also supply a sensor that already formats the text (the badge will show the sensor state whenever it isn't `unknown`/`unavailable`). Leave the option out entirely if you don't want a Now Playing pill.

Running a shared dashboard across multiple kiosks? Set `now_playing_entity: auto` and make sure each Pulse device appends `?pulse_host=<hostname>` (PulseOS now does this automatically). The card will look up `sensor.<pulse_host>_now_playing`, so every kiosk shows its own track without duplicating Lovelace YAML.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **required** | Sensor entity that provides the image URL |
| `fade_ms` | number | `1000` | Cross-fade transition duration in milliseconds |
| `now_playing_entity` | string | `null` | Optional `media_player`/sensor entity for the badge. Set to `"auto"` to follow `sensor.<pulse_host>_now_playing`. |
| `now_playing_label` | string | `"Now Playing"` | Overrides the label shown above the track text |
| `secondary_urls` | array | `[]` | Array of navigation paths to cycle through on tap |
| `overlay_enabled` | bool | auto | Set to `false` to force the legacy overlay even if a kiosk overlay is available. Defaults to `true` when `overlay_url` resolves. |
| `overlay_url` | string | `http://<pulse_host>:8800/overlay` | URL of the PulseOS overlay endpoint. Leave unset to auto-detect via `?pulse_host` query param. |
| `overlay_refresh_entity` | string | `auto` | Optional HA entity (e.g., MQTT sensor) whose state changes when the kiosk publishes overlay refresh hints. Leave unset/`"auto"` to follow `sensor.<pulse_host>_overlay_refresh`; set a custom entity if you use a different naming pattern. |
| `overlay_poll_seconds` | number | `120` | Fallback refresh cadence (seconds) if no refresh entity is configured or events are missed. Set to `0` to disable polling entirely. |

### Overlay endpoint integration

PulseOS 0.12+ exposes a ready-to-render overlay at `http://<pulse-host>:8800/overlay` plus an MQTT hint topic `pulse/<host>/overlay/refresh`. The card can now embed that HTML in an `<iframe>` so timers, alarms, multi-clock layouts, notification badges, and Stop/Snooze buttons stay in perfect sync with the kiosk without reimplementing them in JavaScript.

Recommended setup:

1. Ensure your kiosk URL already includes `?pulse_host=<hostname>` (PulseOS does this automatically). The card will map that hostname to `http://<host>:8800/overlay`.
2. Create an MQTT sensor (or any HA entity) that mirrors `pulse/<host>/overlay/refresh` and name it `sensor.<pulse_host>_overlay_refresh` (for example, `sensor.pulse_living_room_overlay_refresh`). The card auto-detects that entity whenever `overlay_refresh_entity` is unset or `"auto"`. Each time the JSON payload changes, the card re-fetches the overlay HTML. Example:

   ```yaml
   mqtt:
     sensor:
       - name: "Pulse Living Overlay Refresh"
         state_topic: "pulse/living-room/overlay/refresh"
         value_template: "{{ value_json.version }}"
   ```

3. Optionally tighten `overlay_poll_seconds` (default 120) if you want a quicker safety refresh.

If the overlay endpoint can't be reached, the card automatically falls back to its legacy lower-left clock + Now Playing badge so users still see the time.

### Navigation Cycling

When `secondary_urls` is configured, tapping anywhere on **any dashboard** (not just the photo frame) cycles through these URLs and back to the home screen. Each tap advances to the next URL in the array, wrapping back to home after the last one.

**Note:** The global tap handler intelligently skips interactive elements (buttons, links, inputs, etc.) so it won't interfere with normal dashboard interactions. It only handles taps on empty areas of the dashboard.

This feature is particularly useful for kiosk displays where you want simple tap navigation between multiple dashboards.

## Troubleshooting

- **Black screen** → The helper returned a path HA can't serve. Verify `sensor.pulse_current_photo_url` looks like `media-source://media_source/local/...`.
- **Overlay iframe missing / Now Playing auto entity unavailable** → Home Assistant can't resolve your `PULSE_HOST`. Add a DNS/hosts entry or use an IP so the HA host can reach `http://<pulse_host>:8800/overlay`.
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

