# HACS Setup Checklist

## ✅ Fixed in Repository

1. **hacs.json** - Fixed with proper `filename` field
2. **Images in README** - Added logo image to README
3. **info.md** - Created with images and documentation
4. **Card file location** - Added to root directory (HACS expects it there)

## ⚠️ Must be done on GitHub

### 1. Add Repository Description
- Go to your repository on GitHub
- Click **Settings** → **General**
- Scroll to "Repository name and description"
- Add description: `A beautiful, full-screen photo frame card for Home Assistant with smooth crossfades and clock overlay`

### 2. Add Repository Topics
- Still in **Settings** → **General**
- Scroll to "Topics"
- Add these topics (one per line):
  - `home-assistant`
  - `hacs`
  - `lovelace`
  - `custom-card`
  - `photo-frame`
  - `kiosk`

### 3. Verify File Structure
After pushing, verify:
- `pulse-photo-card.js` is in the root directory
- `hacs.json` is in the root directory
- `info.md` is in the root directory
- `README.md` is in the root directory
- `assets/logo.png` exists

## Next Steps

1. Commit and push all changes
2. Add description and topics on GitHub (see above)
3. Create a GitHub release (tag: `v0.13.0`)
4. Verify GitHub Actions pass
5. Submit PR to hacs/default repository

