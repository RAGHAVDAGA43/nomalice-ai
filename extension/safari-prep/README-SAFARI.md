# Safari Web Extension Preparation Guide for NoMalice AI

Safari on macOS and iOS handles web extensions differently than Chromium and Firefox. Safari does not permit loading raw `.zip` or unpacked directories directly from a browser settings page. Instead, Apple requires wrapping standard Manifest V3 web extensions into a lightweight native macOS container app using **Xcode**.

This folder provides everything needed to convert NoMalice AI into a Safari Web Extension.

---

## Prerequisites
- A Mac running **macOS 11 (Big Sur)** or newer
- **Xcode 12** or newer (free from the Mac App Store)
- Xcode Command Line Tools (`xcode-select --install`)

---

## Step-by-Step Conversion

### 1. Run the Safari Extension Packager
Open Terminal on your Mac, navigate to the folder containing this extension, and run:

```bash
xcrun safari-web-extension-packager /path/to/extension --app-name "NoMalice AI Scam Shield" --bundle-identifier com.nomalice.shield
```

This command automatically:
- Reads `manifest.json`, `popup.html`, `popup.js`, and `styles.css`.
- Generates a complete macOS (and iOS) Xcode project in a newly created directory.

### 2. Open the Generated Project in Xcode
```bash
open "NoMalice AI Scam Shield/NoMalice AI Scam Shield.xcodeproj"
```

### 3. Enable Unsigned Extensions for Testing
Because testing during development does not require a paid Apple Developer Account:
1. Open **Safari** on your Mac.
2. Go to **Safari > Settings (or Preferences) > Advanced**.
3. Check the box **"Show features for web developers"** (or "Show Develop menu in menu bar").
4. Go to the new **Develop** menu in the top menu bar.
5. Check **"Allow Unsigned Extensions"** (Safari may prompt for your Mac password).

### 4. Build and Run
1. In Xcode, select the macOS target from the scheme dropdown at the top.
2. Click the **Run** button (or press `Cmd + R`).
3. The companion container app will open with an instruction page.
4. Open **Safari > Settings > Extensions**.
5. Enable **NoMalice AI Scam Shield** and grant it permission for web access.
6. The NoMalice AI shield icon will now appear in your Safari toolbar!

---

## Manifest V3 Compatibility Notes for Safari
- Safari 15.4+ natively supports Manifest V3 (`manifest_version: 3`), `action`, `activeTab`, `scripting`, and `host_permissions`.
- The cross-browser API adapter in `popup.js` (`const extApi = globalThis.browser ?? globalThis.chrome;`) seamlessly handles Safari's `browser.*` and `chrome.*` namespace bridges.
