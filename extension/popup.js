const WEBHOOK_URL = "https://hook.eu1.make.com/upd3jtydwyxjnlot0zfvarehkqktqt2j";
const MAX_FALLBACK_CHARS = 4000;

// Cross-browser API compatibility layer (Firefox, Chrome, Edge, Brave, Opera, Safari)
const extApi = globalThis.browser ?? globalThis.chrome;

let capturedSelection = "";
let capturedPageText = "";
let activeSource = "selection"; // "selection" | "page"

// DOM Elements
const urlInput = document.getElementById("page-url");
const scanTextInput = document.getElementById("scan-text");
const charCountDisplay = document.getElementById("char-count");
const btnSourceSelection = document.getElementById("btn-source-selection");
const btnSourcePage = document.getElementById("btn-source-page");
const btnScan = document.getElementById("btn-scan");
const btnSpinner = document.getElementById("btn-spinner");
const statusMessage = document.getElementById("status-message");
const resultsCard = document.getElementById("results-card");

// Result Elements
const resCategory = document.getElementById("res-category");
const resRiskPill = document.getElementById("res-risk-pill");
const resRiskLevel = document.getElementById("res-risk-level");
const resRiskScore = document.getElementById("res-risk-score");
const resPrimaryRedFlagContainer = document.getElementById("res-primary-red-flag-container");
const resPrimaryRedFlag = document.getElementById("res-primary-red-flag");
const resExplanation = document.getElementById("res-explanation");
const resRedFlagsContainer = document.getElementById("res-red-flags-container");
const resRedFlagsList = document.getElementById("res-red-flags-list");
const resNextStepsContainer = document.getElementById("res-next-steps-container");
const resNextStepsList = document.getElementById("res-next-steps-list");

function updateCharCount() {
  const count = scanTextInput.value.length;
  charCountDisplay.textContent = `${count} characters`;
}

function showStatus(text, type = "info") {
  statusMessage.textContent = text;
  statusMessage.className = `status-box ${type}`;
  statusMessage.hidden = false;
}

function hideStatus() {
  statusMessage.hidden = true;
  statusMessage.textContent = "";
}

function setLoading(isLoading) {
  btnScan.disabled = isLoading;
  btnSpinner.hidden = !isLoading;
  if (isLoading) {
    showStatus("Analyzing text with NoMalice AI...", "info");
  }
}

function setSource(source) {
  activeSource = source;
  if (source === "selection") {
    btnSourceSelection.classList.add("active");
    btnSourcePage.classList.remove("active");
    scanTextInput.value = capturedSelection || "";
  } else {
    btnSourcePage.classList.add("active");
    btnSourceSelection.classList.remove("active");
    scanTextInput.value = capturedPageText || "";
  }
  updateCharCount();
}

// Strip markdown fences or parse JSON
function cleanAndParseJSON(rawText) {
  if (typeof rawText === "object" && rawText !== null) {
    return rawText;
  }

  let text = String(rawText).trim();

  // Strip ```json ... ``` or ``` ... ```
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Find first '{' and last '}' if extra preamble/postamble exists
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(text);
}

function renderResults(data) {
  resultsCard.hidden = false;

  const score = data.risk_score !== undefined ? data.risk_score : 0;
  const level = (data.risk_level || "Safe").trim();
  const category = data.scam_category || "Unclassified";
  const primaryRedFlag = data.primary_red_flag || "";
  const redFlags = Array.isArray(data.red_flags) ? data.red_flags : [];
  const explanation = data.explanation || "No detailed explanation provided.";
  const nextSteps = Array.isArray(data.next_steps) ? data.next_steps : [];

  // Update Category
  resCategory.textContent = category;

  // Update Risk Level & Score
  resRiskScore.textContent = `${score}/100`;
  resRiskLevel.textContent = level;

  // Style Risk Pill
  resRiskPill.classList.remove("risk-safe", "risk-suspicious", "risk-high-risk");
  const normalizedLevel = level.toLowerCase();
  if (normalizedLevel.includes("high") || score >= 70) {
    resRiskPill.classList.add("risk-high-risk");
  } else if (normalizedLevel.includes("suspicious") || score >= 35) {
    resRiskPill.classList.add("risk-suspicious");
  } else {
    resRiskPill.classList.add("risk-safe");
  }

  // Primary Red Flag
  if (primaryRedFlag) {
    resPrimaryRedFlag.textContent = primaryRedFlag;
    resPrimaryRedFlagContainer.hidden = false;
  } else {
    resPrimaryRedFlagContainer.hidden = true;
  }

  // Explanation
  resExplanation.textContent = explanation;

  // Red Flags List
  resRedFlagsList.innerHTML = "";
  if (redFlags.length > 0) {
    redFlags.forEach((flag) => {
      const li = document.createElement("li");
      li.textContent = flag;
      resRedFlagsList.appendChild(li);
    });
    resRedFlagsContainer.hidden = false;
  } else {
    resRedFlagsContainer.hidden = true;
  }

  // Next Steps List
  resNextStepsList.innerHTML = "";
  if (nextSteps.length > 0) {
    nextSteps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      resNextStepsList.appendChild(li);
    });
    resNextStepsContainer.hidden = false;
  } else {
    resNextStepsContainer.hidden = true;
  }
}

// Function injected into the active tab
function extractPageData() {
  const selection = window.getSelection() ? window.getSelection().toString().trim() : "";
  const pageBodyText = document.body ? (document.body.innerText || "").trim() : "";
  return {
    selection,
    pageText: pageBodyText
  };
}

// Helper: Query active tab supporting both Promise and Callback styles
function queryActiveTab() {
  return new Promise((resolve, reject) => {
    try {
      if (!extApi || !extApi.tabs) {
        resolve([]);
        return;
      }
      const result = extApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (extApi.runtime && extApi.runtime.lastError) {
          // Callback style completed with error
          reject(extApi.runtime.lastError);
        } else {
          resolve(tabs || []);
        }
      });
      // If result is a promise (Firefox standard browser.*)
      if (result && typeof result.then === "function") {
        result.then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// Helper: Execute script supporting both Promise and Callback styles
function runScriptInTab(tabId, funcToRun) {
  return new Promise((resolve, reject) => {
    try {
      if (!extApi || !extApi.scripting || !extApi.scripting.executeScript) {
        resolve(null);
        return;
      }
      const executionObj = {
        target: { tabId: tabId },
        func: funcToRun
      };
      const result = extApi.scripting.executeScript(executionObj, (results) => {
        if (extApi.runtime && extApi.runtime.lastError) {
          reject(extApi.runtime.lastError);
        } else {
          resolve(results);
        }
      });
      if (result && typeof result.then === "function") {
        result.then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    const u = new URL(url);
    return u.href;
  } catch (_) {
    return "";
  }
}

// ==========================================================================
// Feature Toggles & Tab Navigation in Extension
// ==========================================================================
const btnToggleSettings = document.getElementById("btn-toggle-settings");
const settingsCard = document.getElementById("settings-card");
const toggleCmdExplainer = document.getElementById("toggle-cmd-explainer");
const toggleWfTransparency = document.getElementById("toggle-wf-transparency");

const tabThreat = document.getElementById("tab-threat");
const tabCommand = document.getElementById("tab-command");
const tabWorkflow = document.getElementById("tab-workflow");
const viewThreat = document.getElementById("view-threat");
const viewCommand = document.getElementById("view-command");
const viewWorkflow = document.getElementById("view-workflow");

const cmdDisabledMsg = document.getElementById("cmd-disabled-msg");
const cmdViewContent = document.getElementById("cmd-view-content");
const wfDisabledMsg = document.getElementById("wf-disabled-msg");
const wfViewContent = document.getElementById("wf-view-content");

// Command Explainer Elements in Extension
const extCmdInput = document.getElementById("ext-cmd-input");
const btnExtExplain = document.getElementById("btn-ext-explain");
const btnExtCmdSample = document.getElementById("btn-ext-cmd-sample");
const extCmdResults = document.getElementById("ext-cmd-results");
const extCmdRisk = document.getElementById("ext-cmd-risk");
const extCmdBlindspot = document.getElementById("ext-cmd-blindspot");
const extCmdWarnings = document.getElementById("ext-cmd-warnings");
const extCmdSteps = document.getElementById("ext-cmd-steps");

// Workflow Transparency Elements in Extension
const extWfApps = document.getElementById("ext-wf-apps");
const btnExtAuditWf = document.getElementById("btn-ext-audit-wf");
const btnExtWfSample = document.getElementById("btn-ext-wf-sample");
const extWfResults = document.getElementById("ext-wf-results");
const extWfBeforeList = document.getElementById("ext-wf-before-list");

function switchTab(viewId) {
  [tabThreat, tabCommand, tabWorkflow].forEach(btn => {
    if (btn) btn.classList.toggle("active", btn.dataset.target === viewId);
  });
  [viewThreat, viewCommand, viewWorkflow].forEach(view => {
    if (view) view.hidden = view.id !== viewId;
  });
}

function updateFeatureToggleUI() {
  const isCmdEnabled = toggleCmdExplainer.checked;
  const isWfEnabled = toggleWfTransparency.checked;

  if (cmdDisabledMsg) cmdDisabledMsg.hidden = isCmdEnabled;
  if (cmdViewContent) cmdViewContent.hidden = !isCmdEnabled;

  if (wfDisabledMsg) wfDisabledMsg.hidden = isWfEnabled;
  if (wfViewContent) wfViewContent.hidden = !isWfEnabled;

  // Persist to storage
  if (extApi && extApi.storage && extApi.storage.local) {
    extApi.storage.local.set({
      enableCommandExplainer: isCmdEnabled,
      enableWorkflowTransparency: isWfEnabled
    });
  }

  // Notify background script about context menu status
  if (extApi && extApi.runtime && extApi.runtime.sendMessage) {
    try {
      extApi.runtime.sendMessage({
        type: "TOGGLE_COMMAND_EXPLAINER",
        enabled: isCmdEnabled
      });
    } catch (_) {}
  }
}

function loadSavedSettings() {
  if (extApi && extApi.storage && extApi.storage.local) {
    extApi.storage.local.get({
      enableCommandExplainer: true,
      enableWorkflowTransparency: true,
      pendingInspectCommand: ""
    }, (items) => {
      toggleCmdExplainer.checked = items.enableCommandExplainer !== false;
      toggleWfTransparency.checked = items.enableWorkflowTransparency !== false;
      updateFeatureToggleUI();

      // If user selected text via context menu before opening popup
      if (items.pendingInspectCommand) {
        switchTab("view-command");
        extCmdInput.value = items.pendingInspectCommand;
        handleExtExplainCommand();
        extApi.storage.local.remove("pendingInspectCommand");
      }
    });
  } else {
    updateFeatureToggleUI();
  }
}

// Extension Command Explainer Logic
function handleExtExplainCommand() {
  const cmd = (extCmdInput.value || "").trim();
  if (!cmd) return;

  extCmdResults.hidden = false;

  let hasBlindspot = false;
  let risk = "Safe";
  const warnings = [];

  if (/\|\s*(?:sudo\s+)?(?:sh|bash|zsh|powershell|cmd)\b/i.test(cmd)) {
    hasBlindspot = true;
    risk = "High Risk";
    warnings.push("Remote script piped directly into interpreter at runtime (uninspectable blind-spot).");
  }

  if (/\b(?:sudo|doas|runas)\b/i.test(cmd)) {
    risk = "High Risk";
    warnings.push("Requests root or superuser system privileges.");
  }

  if (/\b(?:curl|wget|Invoke-WebRequest|iwr)\b/i.test(cmd)) {
    if (risk === "Safe") risk = "Suspicious";
    warnings.push("Downloads external resources from network.");
  }

  if (/\b(?:rm\s+-rf|chmod\s+\+x|chmod\s+777)\b/i.test(cmd)) {
    if (risk === "Safe") risk = "Suspicious";
    warnings.push("Modifies file permissions or destroys directory tree.");
  }

  extCmdBlindspot.hidden = !hasBlindspot;
  extCmdRisk.textContent = risk;
  extCmdRisk.className = `risk-pill ${risk === 'High Risk' ? 'risk-high-risk' : risk === 'Suspicious' ? 'risk-suspicious' : 'risk-safe'}`;

  if (warnings.length > 0) {
    extCmdWarnings.hidden = false;
    extCmdWarnings.innerHTML = warnings.map(w => `<div class="ext-warning-chip">⚠️ ${w}</div>`).join('');
  } else {
    extCmdWarnings.hidden = true;
  }

  const parts = cmd.split(/(\|{1,2}|&&|;)/).map(s => s.trim()).filter(Boolean);
  extCmdSteps.innerHTML = parts.map((part, i) => {
    let desc = `Runs: <code>${part}</code>`;
    if (part.startsWith("curl") || part.startsWith("wget")) desc = "Fetches remote payload via network.";
    if (part === "sudo sh" || part === "sh" || part === "bash") desc = "Executes piped stream in shell interpreter.";
    if (part.startsWith("npm")) desc = "Node.js package manager operation.";
    return `
      <div class="ext-step-item">
        <div class="ext-step-item-title">Step ${i + 1}</div>
        <div class="ext-step-item-desc">${desc}</div>
      </div>
    `;
  }).join('');
}

// Extension Workflow Transparency Logic
function handleExtAuditWorkflow() {
  const appsStr = (extWfApps.value || "").trim();
  if (!appsStr) return;

  extWfResults.hidden = false;
  const apps = appsStr.split(/[,+&]/).map(a => a.trim()).filter(Boolean);

  let listHtml = "";
  apps.forEach(app => {
    const a = app.toLowerCase();
    let level = "Medium";
    if (a.includes("gmail") || a.includes("stripe")) level = "High";
    if (a.includes("slack") || a.includes("discord")) level = "Low";

    listHtml += `
      <div class="ext-wf-scope-row">
        <span>${app}</span>
        <span class="ext-wf-scope-level ${level}">${level} Risk</span>
      </div>
    `;
  });
  extWfBeforeList.innerHTML = listHtml;
}

async function initializePopup() {
  updateCharCount();
  scanTextInput.addEventListener("input", updateCharCount);

  btnSourceSelection.addEventListener("click", () => setSource("selection"));
  btnSourcePage.addEventListener("click", () => setSource("page"));

  btnScan.addEventListener("click", handleScan);

  // Settings & Toggles
  if (btnToggleSettings) {
    btnToggleSettings.addEventListener("click", () => {
      settingsCard.hidden = !settingsCard.hidden;
    });
  }

  if (toggleCmdExplainer) toggleCmdExplainer.addEventListener("change", updateFeatureToggleUI);
  if (toggleWfTransparency) toggleWfTransparency.addEventListener("change", updateFeatureToggleUI);

  // Tabs
  [tabThreat, tabCommand, tabWorkflow].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => switchTab(btn.dataset.target));
    }
  });

  // CLI Explainer
  if (btnExtExplain) btnExtExplain.addEventListener("click", handleExtExplainCommand);
  if (btnExtCmdSample) {
    btnExtCmdSample.addEventListener("click", () => {
      extCmdInput.value = "curl -fsSL https://get.docker.com | sudo sh";
      handleExtExplainCommand();
    });
  }

  // Workflow
  if (btnExtAuditWf) btnExtAuditWf.addEventListener("click", handleExtAuditWorkflow);
  if (btnExtWfSample) {
    btnExtWfSample.addEventListener("click", () => {
      extWfApps.value = "Gmail, Google Drive, Slack, Webhook";
      handleExtAuditWorkflow();
    });
  }

  loadSavedSettings();

  try {
    const tabs = await queryActiveTab();
    if (!tabs || tabs.length === 0) {
      showStatus("No active browser tab found.", "info");
      return;
    }

    const activeTab = tabs[0];
    if (activeTab.url) {
      urlInput.value = activeTab.url;
    }

    // Check for internal browser URLs across browsers (chrome://, edge://, about:, safari-extension:, etc.)
    const u = activeTab.url || "";
    if (
      u.startsWith("chrome://") ||
      u.startsWith("chrome-extension://") ||
      u.startsWith("edge://") ||
      u.startsWith("about:") ||
      u.startsWith("safari-extension:") ||
      u.startsWith("moz-extension://") ||
      u.startsWith("opera://")
    ) {
      showStatus("Internal browser page detected. Paste URL or text manually to scan.", "info");
      return;
    }

    // Execute script to get selection and body text
    const results = await runScriptInTab(activeTab.id, extractPageData);

    if (results && results[0] && results[0].result) {
      const { selection, pageText } = results[0].result;
      capturedSelection = selection || "";
      capturedPageText = (pageText || "").slice(0, MAX_FALLBACK_CHARS);

      if (capturedSelection) {
        setSource("selection");
      } else if (capturedPageText) {
        setSource("page");
      }
    }
  } catch (err) {
    console.warn("Script execution warning:", err);
    showStatus("Could not automatically inspect tab. You can paste URL or text manually.", "info");
  }
}

document.addEventListener("DOMContentLoaded", initializePopup);
