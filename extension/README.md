# NoMalice AI Scam Shield — Cross-Browser Extension

Manifest V3 browser extension for scanning suspicious text, emails, messages, and webpages for scams, phishing, and fraud using NoMalice AI.

---

## Supported Browsers
- **Google Chrome** (v88+)
- **Microsoft Edge** (v88+)
- **Brave Browser**
- **Opera / Opera GX**
- **Mozilla Firefox** (v109+ via `browser_specific_settings.gecko`)
- **Apple Safari** (v15.4+ via Xcode packaging)

---

## Installation Guide by Browser

### 1. Google Chrome / Brave / Opera
1. Open your browser and navigate to `chrome://extensions` (or `brave://extensions`, `opera://extensions`).
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select this `extension/` directory.

### 2. Microsoft Edge
1. Navigate to `edge://extensions`.
2. Turn on the **Developer mode** toggle in the left navigation sidebar.
3. Click **Load unpacked** and select this `extension/` directory.

### 3. Mozilla Firefox
1. Open Firefox and type `about:debugging` in the address bar.
2. Click **This Firefox** in the left sidebar.
3. Under *Temporary Extensions*, click **Load Temporary Add-on...**.
4. Select `manifest.json` from this `extension/` directory.
5. The extension will remain active until Firefox is restarted (or permanently if signed).

### 4. Apple Safari (macOS)
Safari requires packaging the extension into a native macOS container app using Apple's free developer tools:
1. Open `safari-prep/README-SAFARI.md` for full instructions.
2. Run `xcrun safari-web-extension-packager` to generate an Xcode project.
3. In Safari, check **Allow Unsigned Extensions** under the **Develop** menu, then build and run via Xcode.
