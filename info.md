# Pulse Photo Card

![Pulse Photo Card Logo](https://raw.githubusercontent.com/weirdtangent/pulse-photo-card/main/assets/logo.png)

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

1. Download `dist/pulse-photo-card.js` from this repository
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

### With Navigation Cycling

```yaml
type: custom:pulse-photo-card
entity: sensor.pulse_current_photo_url
fade_ms: 1200
secondary_urls:
  - /dashboard-pulse/0
  - /dashboard-weather
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **required** | Sensor entity that provides the image URL |
| `fade_ms` | number | `1000` | Cross-fade transition duration in milliseconds |
| `secondary_urls` | array | `[]` | Array of navigation paths to cycle through on tap |

## Related Projects

This card was originally created for [Pulse OS](https://github.com/weirdtangent/pulse-os), a Raspberry Pi kiosk setup for Home Assistant. While it works great with Pulse devices, it's a standalone card that works with any Home Assistant installation.

