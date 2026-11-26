/**
 * NoMalice AI Scam Shield - Background Service Worker
 * Handles cross-browser context menu registration and toggles safely.
 */

const extApi = globalThis.browser ?? globalThis.chrome;

const CONTEXT_MENU_ID = "nomalice_explain_command";

function updateContextMenu(enabled) {
  if (!extApi || !extApi.contextMenus) return;

  try {
    extApi.contextMenus.removeAll(() => {
      if (extApi.runtime && extApi.runtime.lastError) {
        // Ignored, clean remove attempt
      }
      if (enabled) {
        extApi.contextMenus.create({
          id: CONTEXT_MENU_ID,
          title: "🛡️ Explain Command with NoMalice AI",
          contexts: ["selection"]
        }, () => {
          if (extApi.runtime && extApi.runtime.lastError) {
            // Already created or handled
          }
        });
      }
    });
  } catch (err) {
    console.warn("Context menu setup warning:", err);
  }
}

// On install or startup, read settings
if (extApi && extApi.runtime && extApi.runtime.onInstalled) {
  extApi.runtime.onInstalled.addListener(() => {
    if (extApi.storage && extApi.storage.local) {
      extApi.storage.local.get({ enableCommandExplainer: true }, (items) => {
        updateContextMenu(items.enableCommandExplainer !== false);
      });
    } else {
      updateContextMenu(true);
    }
  });
}

// Listen for toggle updates from popup
if (extApi && extApi.runtime && extApi.runtime.onMessage) {
  extApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "TOGGLE_COMMAND_EXPLAINER") {
      updateContextMenu(Boolean(message.enabled));
      if (sendResponse) sendResponse({ ok: true });
    }
    return true;
  });
}

// Context menu click handler
if (extApi && extApi.contextMenus && extApi.contextMenus.onClicked) {
  extApi.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
      // Save selected command to storage for the popup to open and inspect
      if (extApi.storage && extApi.storage.local) {
        extApi.storage.local.set({
          pendingInspectCommand: info.selectionText.trim()
        }, () => {
          // Open popup if supported or alert via badge
          if (extApi.action && extApi.action.openPopup) {
            extApi.action.openPopup().catch(() => {});
          }
        });
      }
    }
  });
}
