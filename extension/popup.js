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

async function initializePopup() {
  updateCharCount();
  scanTextInput.addEventListener("input", updateCharCount);

  btnSourceSelection.addEventListener("click", () => setSource("selection"));
  btnSourcePage.addEventListener("click", () => setSource("page"));

  btnScan.addEventListener("click", handleScan);

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
      showStatus("Internal browser page detected. Paste text manually to scan.", "info");
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
      } else {
        showStatus("No text detected on page. Paste text directly to scan.", "info");
      }
    }
  } catch (err) {
    console.warn("Script execution warning:", err);
    showStatus("Could not automatically inspect tab. You can paste text manually.", "info");
  }
}

async function handleScan() {
  const textToScan = scanTextInput.value.trim();
  const urlToScan = urlInput.value.trim();

  if (!textToScan) {
    showStatus("Please enter or select some text before scanning.", "error");
    return;
  }

  hideStatus();
  resultsCard.hidden = true;
  setLoading(true);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "Extension",
        url: urlToScan,
        text: textToScan
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
    }

    const rawResponseText = await response.text();
    let parsedData;

    try {
      parsedData = cleanAndParseJSON(rawResponseText);
    } catch (parseErr) {
      console.error("JSON parse failure on response:", rawResponseText, parseErr);
      throw new Error(`Failed to parse response as JSON. Raw output: ${rawResponseText.slice(0, 150)}...`);
    }

    hideStatus();
    renderResults(parsedData);
  } catch (err) {
    console.error("Scan error:", err);
    showStatus(`Scan failed: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", initializePopup);
