/**
 * NoMalice AI — Threat Analyzer Application Logic
 * Cross-browser, zero external frameworks, zero paid APIs, pure vanilla JS.
 */

const WEBHOOK_URL = "https://hook.eu1.make.com/upd3jtydwyxjnlot0zfvarehkqktqt2j";
const STORAGE_KEY = "nomalice_recent_scans";
const MAX_RECENT_SCANS = 8;

// Preset sample attacks and safe messages
const SAMPLES = {
  high: {
    text: "URGENT SECURITY ALERT: Your Chase Checking Account #8192 has been frozen due to unauthorized wire attempt from Moscow, Russia. You must verify your account ownership, full Social Security Number, and debit ATM PIN within 4 hours or all funds will be permanently impounded under federal compliance order: https://chase-security-restore-access.com/verify?account=8192",
    url: "https://chase-security-restore-access.com/verify?account=8192"
  },
  suspicious: {
    text: "FedEx Express: We attempted delivery of your high-priority parcel #US-98214-GD today but recipient address was incomplete. A re-delivery surcharge of $2.85 is required before 11:59 PM or the shipment will be discarded. Complete customs clearance form: https://fedx-package-clearance.biz/tracking",
    url: "https://fedx-package-clearance.biz/tracking"
  },
  safe: {
    text: "Hi Alex, hope your week is off to a great start! Just sending a quick recap of our quarterly sprint planning notes. Please check the updated product roadmap in Notion and let me know if the engineering milestones look realistic before Thursday's sync.",
    url: "https://www.notion.so/workspace/quarterly-roadmap"
  }
};

let currentReportData = null;

// DOM Elements
const form = document.getElementById("threat-form");
const inputText = document.getElementById("input-text");
const inputUrl = document.getElementById("input-url");
const charCounter = document.getElementById("char-counter");
const btnAnalyze = document.getElementById("btn-analyze");
const btnClear = document.getElementById("btn-clear");
const loaderSpinner = document.getElementById("loader-spinner");
const scanLaser = document.getElementById("scan-laser");
const statusBanner = document.getElementById("status-banner");

// Sample Preset Buttons
const btnSampleHigh = document.getElementById("btn-sample-high");
const btnSampleSuspicious = document.getElementById("btn-sample-suspicious");
const btnSampleSafe = document.getElementById("btn-sample-safe");

// Guide Tabs
const tabBtnChromium = document.getElementById("tab-btn-chromium");
const tabBtnFirefox = document.getElementById("tab-btn-firefox");
const tabBtnSafari = document.getElementById("tab-btn-safari");
const tabContentChromium = document.getElementById("tab-content-chromium");
const tabContentFirefox = document.getElementById("tab-content-firefox");
const tabContentSafari = document.getElementById("tab-content-safari");

// Report Panel & Fields
const reportPanel = document.getElementById("report-panel");
const resCategory = document.getElementById("res-category");
const resRiskBadge = document.getElementById("res-risk-badge");
const resRiskLevel = document.getElementById("res-risk-level");
const resRiskScoreText = document.getElementById("res-risk-score-text");
const resMeterFill = document.getElementById("res-meter-fill");

const resPrimaryBlock = document.getElementById("res-primary-block");
const resPrimaryRedFlag = document.getElementById("res-primary-red-flag");
const resExplanation = document.getElementById("res-explanation");
const resFlagsBlock = document.getElementById("res-flags-block");
const resRedFlagsList = document.getElementById("res-red-flags-list");
const resStepsBlock = document.getElementById("res-steps-block");
const resNextStepsList = document.getElementById("res-next-steps-list");

// Report Tools & JSON Viewer
const btnCopyReport = document.getElementById("btn-copy-report");
const btnToggleJson = document.getElementById("btn-toggle-json");
const copyToast = document.getElementById("copy-toast");
const rawJsonViewer = document.getElementById("raw-json-viewer");
const rawJsonCode = document.getElementById("raw-json-code");

// Recent Scans History (LocalStorage)
const historyPanel = document.getElementById("history-panel");
const historyList = document.getElementById("history-list");
const btnClearHistory = document.getElementById("btn-clear-history");

function updateCharCount() {
  const count = inputText.value.length;
  charCounter.textContent = `${count} characters`;
}

function showStatus(text, type = "info") {
  statusBanner.textContent = text;
  statusBanner.className = `status-banner ${type}`;
  statusBanner.hidden = false;
}

function hideStatus() {
  statusBanner.hidden = true;
  statusBanner.textContent = "";
}

function setLoading(isLoading) {
  btnAnalyze.disabled = isLoading;
  loaderSpinner.hidden = !isLoading;
  scanLaser.hidden = !isLoading;

  if (isLoading) {
    showStatus("Conducting deep neural scan with NoMalice AI engine... Please wait.", "info");
  }
}

// Switch between installation tabs
function setupGuideTabs() {
  const tabs = [
    { btn: tabBtnChromium, content: tabContentChromium },
    { btn: tabBtnFirefox, content: tabContentFirefox },
    { btn: tabBtnSafari, content: tabContentSafari }
  ];

  tabs.forEach(({ btn, content }) => {
    if (!btn || !content) return;
    btn.addEventListener("click", () => {
      tabs.forEach(t => {
        t.btn.classList.remove("active");
        t.content.classList.remove("active");
      });
      btn.classList.add("active");
      content.classList.add("active");
    });
  });
}

// Strip markdown fences or parse JSON safely
function cleanAndParseJSON(rawText) {
  if (typeof rawText === "object" && rawText !== null) {
    return rawText;
  }

  let text = String(rawText).trim();

  // Strip ```json ... ``` or ``` ... ```
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Find boundaries of outer JSON object
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(text);
}

function renderResults(data, scrollIntoView = true) {
  currentReportData = data;
  reportPanel.hidden = false;

  const score = Math.max(0, Math.min(100, Number(data.risk_score !== undefined ? data.risk_score : 0)));
  const level = (data.risk_level || "Safe").trim();
  const category = data.scam_category || "Unclassified Threat";
  const primaryRedFlag = data.primary_red_flag || "";
  const redFlags = Array.isArray(data.red_flags) ? data.red_flags : [];
  const explanation = data.explanation || "No technical explanation provided.";
  const nextSteps = Array.isArray(data.next_steps) ? data.next_steps : [];

  // 1. Category
  resCategory.textContent = category;

  // 2. Risk Level & Badge styling
  resRiskLevel.textContent = level;
  resRiskBadge.classList.remove("badge-safe", "badge-suspicious", "badge-high-risk");

  const normalizedLevel = level.toLowerCase();
  let theme = "safe";

  if (normalizedLevel.includes("high") || score >= 70) {
    theme = "high-risk";
    resRiskBadge.classList.add("badge-high-risk");
  } else if (normalizedLevel.includes("suspicious") || score >= 35) {
    theme = "suspicious";
    resRiskBadge.classList.add("badge-suspicious");
  } else {
    theme = "safe";
    resRiskBadge.classList.add("badge-safe");
  }

  // 3. Score text & animated meter bar
  resRiskScoreText.textContent = `${score} / 100`;
  resMeterFill.className = `meter-fill meter-${theme}`;

  // Trigger smooth fill animation
  setTimeout(() => {
    resMeterFill.style.width = `${score}%`;
  }, 40);

  // 4. Primary Red Flag
  if (primaryRedFlag) {
    resPrimaryRedFlag.textContent = primaryRedFlag;
    resPrimaryBlock.hidden = false;
  } else {
    resPrimaryBlock.hidden = true;
  }

  // 5. Threat Explanation
  resExplanation.textContent = explanation;

  // 6. Red Flags list
  resRedFlagsList.innerHTML = "";
  if (redFlags.length > 0) {
    redFlags.forEach((flag) => {
      const li = document.createElement("li");
      li.textContent = flag;
      resRedFlagsList.appendChild(li);
    });
    resFlagsBlock.hidden = false;
  } else {
    resFlagsBlock.hidden = true;
  }

  // 7. Recommended Next Steps list
  resNextStepsList.innerHTML = "";
  if (nextSteps.length > 0) {
    nextSteps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      resNextStepsList.appendChild(li);
    });
    resStepsBlock.hidden = false;
  } else {
    resStepsBlock.hidden = true;
  }

  // Update Raw JSON view
  rawJsonCode.textContent = JSON.stringify(data, null, 2);
  rawJsonViewer.hidden = true;
  btnToggleJson.innerHTML = '<span class="tool-icon">{ }</span> Raw JSON';

  copyToast.hidden = true;

  if (scrollIntoView) {
    reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Copy 7-field summary to clipboard
function copyReportToClipboard() {
  if (!currentReportData) return;

  const score = currentReportData.risk_score !== undefined ? currentReportData.risk_score : "N/A";
  const level = currentReportData.risk_level || "Unknown";
  const category = currentReportData.scam_category || "Unclassified";
  const primaryRedFlag = currentReportData.primary_red_flag || "None detected";
  const redFlags = Array.isArray(currentReportData.red_flags) && currentReportData.red_flags.length > 0
    ? currentReportData.red_flags.map(f => `  • ${f}`).join("\n")
    : "  • None detected";
  const explanation = currentReportData.explanation || "N/A";
  const nextSteps = Array.isArray(currentReportData.next_steps) && currentReportData.next_steps.length > 0
    ? currentReportData.next_steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")
    : "  • No action required";

  const formattedReport = 
`==============================================
NOMALICE AI THREAT INTELLIGENCE REPORT
==============================================
1. Risk Level: ${level}
2. Risk Score: ${score} / 100
3. Scam Category: ${category}
4. Primary Red Flag: ${primaryRedFlag}

5. Threat Explanation:
${explanation}

6. Red Flags Detected:
${redFlags}

7. Recommended Next Steps:
${nextSteps}
==============================================
Engine: NoMalice AI Scam Shield
==============================================`;

  navigator.clipboard.writeText(formattedReport).then(() => {
    copyToast.hidden = false;
    setTimeout(() => {
      copyToast.hidden = true;
    }, 3500);
  }).catch((err) => {
    console.warn("Clipboard access failed:", err);
    showStatus("Unable to write to clipboard. Please check browser permissions.", "info");
  });
}

// Toggle Raw JSON display
function toggleRawJson() {
  const isHidden = rawJsonViewer.hidden;
  rawJsonViewer.hidden = !isHidden;
  btnToggleJson.innerHTML = isHidden 
    ? '<span class="tool-icon">✕</span> Hide JSON'
    : '<span class="tool-icon">{ }</span> Raw JSON';
}

// LocalStorage Recent Scans Cache
function getRecentScans() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Error reading from localStorage:", err);
    return [];
  }
}

function saveRecentScan(inputTextVal, inputUrlVal, reportData) {
  try {
    let scans = getRecentScans();
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: inputTextVal,
      url: inputUrlVal,
      preview: inputTextVal.slice(0, 80).trim() + (inputTextVal.length > 80 ? "..." : ""),
      data: reportData
    };

    // Filter duplicate text
    scans = scans.filter(s => s.text !== inputTextVal);
    scans.unshift(newEntry);

    if (scans.length > MAX_RECENT_SCANS) {
      scans = scans.slice(0, MAX_RECENT_SCANS);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
    renderRecentScans();
  } catch (err) {
    console.warn("Error saving to localStorage:", err);
  }
}

function clearRecentScans() {
  localStorage.removeItem(STORAGE_KEY);
  renderRecentScans();
}

function renderRecentScans() {
  const scans = getRecentScans();
  if (scans.length === 0) {
    historyPanel.hidden = true;
    historyList.innerHTML = "";
    return;
  }

  historyPanel.hidden = false;
  historyList.innerHTML = "";

  scans.forEach((scan) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const level = (scan.data && scan.data.risk_level) ? scan.data.risk_level.trim() : "Safe";
    const score = (scan.data && scan.data.risk_score !== undefined) ? scan.data.risk_score : 0;
    let badgeClass = "safe";
    const lowerLevel = level.toLowerCase();
    if (lowerLevel.includes("high") || score >= 70) badgeClass = "high-risk";
    else if (lowerLevel.includes("suspicious") || score >= 35) badgeClass = "suspicious";

    li.innerHTML = `
      <div class="history-meta">
        <span class="history-preview">${escapeHtml(scan.preview)}</span>
        <span class="history-time">${scan.timestamp} &bull; ${escapeHtml(scan.data.scam_category || "Scan")}</span>
      </div>
      <span class="history-badge-pill ${badgeClass}">${escapeHtml(level)} (${score})</span>
    `;

    li.addEventListener("click", () => {
      inputText.value = scan.text;
      inputUrl.value = scan.url || "";
      updateCharCount();
      renderResults(scan.data, true);
    });

    historyList.appendChild(li);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function handleAnalyze(e) {
  if (e) e.preventDefault();

  const text = inputText.value.trim();
  const url = inputUrl.value.trim();

  if (!text) {
    showStatus("Please paste or enter the content to scan before analyzing.", "error");
    inputText.focus();
    return;
  }

  hideStatus();
  reportPanel.hidden = true;
  setLoading(true);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "WebApp",
        url: url,
        text: text
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status} (${response.statusText})`);
    }

    const rawResponseText = await response.text();
    let parsedData;

    try {
      parsedData = cleanAndParseJSON(rawResponseText);
    } catch (parseErr) {
      console.error("JSON Parse failure:", rawResponseText, parseErr);
      throw new Error(`Received unexpected non-JSON response from server: ${rawResponseText.slice(0, 140)}...`);
    }

    hideStatus();
    renderResults(parsedData, true);
    saveRecentScan(text, url, parsedData);
  } catch (err) {
    console.error("Analysis error:", err);
    showStatus(`Threat analysis failed: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
}

function handleClear() {
  inputText.value = "";
  inputUrl.value = "";
  updateCharCount();
  hideStatus();
  reportPanel.hidden = true;
  currentReportData = null;
  inputText.focus();
}

function loadSample(sampleKey) {
  const sample = SAMPLES[sampleKey];
  if (!sample) return;

  inputText.value = sample.text;
  inputUrl.value = sample.url;
  updateCharCount();
  hideStatus();
  reportPanel.hidden = true;
}

function initialize() {
  updateCharCount();
  setupGuideTabs();
  renderRecentScans();

  inputText.addEventListener("input", updateCharCount);
  form.addEventListener("submit", handleAnalyze);
  btnClear.addEventListener("click", handleClear);

  // Preset sample buttons
  btnSampleHigh.addEventListener("click", () => loadSample("high"));
  btnSampleSuspicious.addEventListener("click", () => loadSample("suspicious"));
  btnSampleSafe.addEventListener("click", () => loadSample("safe"));

  // Report actions
  btnCopyReport.addEventListener("click", copyReportToClipboard);
  btnToggleJson.addEventListener("click", toggleRawJson);
  btnClearHistory.addEventListener("click", clearRecentScans);

  // Shortcut: Ctrl+Enter / Cmd+Enter
  inputText.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleAnalyze();
    }
  });
}

document.addEventListener("DOMContentLoaded", initialize);
