# Pulse Photo Card

![Pulse Photo Card Logo](https://raw.githubusercontent.com/weirdtangent/pulse-photo-card/main/assets/logo.png)

A full-screen photo frame card for Home Assistant with smooth crossfades, clock overlay, and optional tap-to-view Lovelace dashboards. Integration with Pulse-OS adds live overlay, timers, and more.

## Features

- **Smooth crossfades** - Double-buffered image transitions with no white flash
- **Clock overlay** - Displays current time and date with automatic locale/timezone support
- **Now Playing badge** - Optional artist/title ribbon powered by any HA entity
- **Media source support** - Works with Home Assistant's media browser and signed URLs
- **PulseOS overlay embed** - Mirrors the kiosk-hosted overlay HTML (multiple clocks, timers, alarms, notification bar) with automatic fallback to the built-in clock
- **Tap-to-view dashboards** - Load Lovelace view configs right in the card by tapping the photo, complete with nav buttons and auto-return
- **Responsive design** - Adapts to any screen size with responsive typography

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

## Configuration

### Basic Usage

```yaml
type: custom:pulse-photo-card
entity: sensor.pulse_current_photo_url
fade_ms: 1200
```

### With Now Playing Badge

```yaml
type: custom:pulse-photo-card
entity: sensor.pulse_current_photo_url
now_playing_entity: auto
```

Set `now_playing_entity: auto` and include `?pulse_host=<hostname>` in the kiosk URL (PulseOS handles this automatically) to have the card follow `sensor.<hostname>_now_playing` per device.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **required** | Sensor entity that provides the image URL |
| `fade_ms` | number | `1000` | Cross-fade transition duration in milliseconds |
| `now_playing_entity` | string | `null` | Optional `media_player`/sensor entity for the badge (`"auto"` targets `sensor.<pulse_host>_now_playing`) |
| `now_playing_label` | string | `"Now Playing"` | Overrides the label shown above the track text |
| `overlay_enabled` | bool | auto | Override to force-enable/disable the kiosk overlay embed. Defaults to `true` when `overlay_url` resolves. |
| `overlay_url` | string | `http://<pulse_host>:8800/overlay` | PulseOS overlay endpoint URL. Leave blank to auto-detect via `?pulse_host` (a `.local` suffix is added when the hostname has no domain). |
| `overlay_refresh_entity` | string | `auto` | HA entity whose state changes when the kiosk publishes `pulse/<host>/overlay/refresh`. Leave unset/`"auto"` to follow `sensor.<pulse_host>_overlay_refresh`. |
| `overlay_poll_seconds` | number | `120` | Backup refresh cadence (seconds). Set `0` to disable polling. |
| `views` | array | `[]` | Optional Lovelace view definitions (sections/grid/cards) that the card can cycle through when tapped. |
| `view_timeout_seconds` | number | `180` | How long to keep a view open before automatically returning to the photo. |
| `debug` | bool | `false` | Enable verbose console logging (suppressed by default). |

### Tap-to-view dashboards

Add one or more Lovelace views under the `views:` key to let the card behave like a miniature dashboard browser. Tap anywhere on the photo to open the first view, then use the nav buttons (previous / home / next) in the notification bar to move through the configured views or jump back to the photo. The card automatically returns to the photo after `view_timeout_seconds` (default 180 s). You can design these dashboards in a normal Lovelace editor and then copy/paste the YAML directly into the `views` array.

## Related Projects

This card was originally created for [Pulse OS](https://github.com/weirdtangent/pulse-os), a Raspberry Pi kiosk setup for Home Assistant. While it works great with Pulse devices, it's a standalone card that works with any Home Assistant installation.

