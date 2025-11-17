# Pulse Photo Card

![Pulse Photo Card](assets/logo.png)

A beautiful, full-screen photo frame card for Home Assistant with smooth crossfades, clock overlay, and optional navigation cycling for kiosk displays.

## Features

- **Smooth crossfades** - Double-buffered image transitions with no white flash
- **Clock overlay** - Displays current time and date with automatic locale/timezone support
- **Media source support** - Works with Home Assistant's media browser and signed URLs
- **Navigation cycling** - Optional tap-to-cycle through multiple dashboards (perfect for kiosks)
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
        secondary_urls:        # optional, array of URLs to cycle through on tap
          - /dashboard-pulse/0
          - /dashboard-weather
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **required** | Sensor entity that provides the image URL |
| `fade_ms` | number | `1000` | Cross-fade transition duration in milliseconds |
| `secondary_urls` | array | `[]` | Array of navigation paths to cycle through on tap |

### Navigation Cycling

When `secondary_urls` is configured, tapping anywhere on **any dashboard** (not just the photo frame) cycles through these URLs and back to the home screen. Each tap advances to the next URL in the array, wrapping back to home after the last one.

**Note:** The global tap handler intelligently skips interactive elements (buttons, links, inputs, etc.) so it won't interfere with normal dashboard interactions. It only handles taps on empty areas of the dashboard.

This feature is particularly useful for kiosk displays where you want simple tap navigation between multiple dashboards.

## Troubleshooting

- **Black screen** → The helper returned a path HA can't serve. Verify `sensor.pulse_current_photo_url` looks like `media-source://media_source/local/...`.
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

