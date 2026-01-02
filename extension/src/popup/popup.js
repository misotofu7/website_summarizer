console.log("popup.js loaded", window.location.href);

// grab DOM elements from popup.html
const apiInput = document.getElementById("api-key");
const rememberCheckbox = document.getElementById("remember-key");
const saveButton = document.getElementById("save-api-key");
const clearButton = document.getElementById("clear-api-key");
const extractButton = document.getElementById("extract");
const summaryContainer = document.getElementById("summary-container");
const statusEl = document.getElementById("status");

const modesPanel = document.getElementById("modes-panel");
const explanationButton = document.getElementById("explanation-modes");

// debugging purposes, ensure DOM elements exist
if (!apiInput || !rememberCheckbox || !saveButton || !clearButton || !extractButton || !summaryContainer || !statusEl || !modesPanel || !explanationButton) {
  console.error("Popup elements missing — check popup.html IDs");
  throw new Error("Missing DOM elements!");
}

function setStatus(message, isError = false) {
  statusEl.innerText = message;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

// set default mode when popup opens
let selectedMode = "like_i_am_5";

// STORING KEY (based on if user chooses to remember or not)
// local --> higher risk
// session --> safer, cleared when browser closes (default)
async function saveKey(key, remember) {
  if (remember) {
    await chrome.storage.local.set({ openaiApiKey: key, rememberKey: true });
    await chrome.storage.session.remove(["openaiApiKey"]);
  }
  else {
    await chrome.storage.session.set({ openaiApiKey: key });
    await chrome.storage.local.set({ rememberKey: false });
    await chrome.storage.local.remove(["openaiApiKey"]);
  }
}

async function loadKey() {
  const { rememberKey } = await chrome.storage.local.get(["rememberKey"]);
  rememberCheckbox.checked = !!rememberKey;

  if (rememberKey) {
    const { openaiApiKey } = await chrome.storage.local.get(["openaiApiKey"]);
    return openaiApiKey || "";
  }
  else {
    const { openaiApiKey } = await chrome.storage.session.get(["openaiApiKey"]);
    return openaiApiKey || "";
  }
}

// remove key in both local and session storages, set remember key to false
async function clearKey() {
  await chrome.storage.local.remove(["openaiApiKey"]);
  await chrome.storage.local.set({ rememberKey: false });
  await chrome.storage.session.remove(["openaiApiKey"]);
}

// load key when popup opens (if key is saved and accessible)
(async () => {
  const key = await loadKey();
  if (key) {
    apiInput.value = key;
    setStatus(rememberCheckbox.checked ? "Key loaded (remembered)." : "Key loaded (session).");
  }
  else {
    setStatus("No key saved. Input your key to use summarization.");
  }
})();

// save API key (enter button or manual clicking of save button)
async function handleSaveKey() {
  // read input value and trims whitespace
  const key = apiInput.value.trim();

  // ask user for API key if not inputted yet
  if (!key) {
    setStatus("Input an API key first.", true);
    return;
  }

  // OpenAI keys start with "sk-"
  if (!key.startsWith("sk-")) {
    // alert and exit early when input is invalid
    setStatus("Invalid API key. Please try again.", true);
    return;
  }

  try {
    await saveKey(key, rememberCheckbox.checked);
    setStatus(rememberCheckbox.checked ? "Saved (remembered on this device)." : "Saved (session only).");
  }
  catch (e) {
    console.error(e);
    setStatus("Failed to save key.", true);
  }
}

// runs when user clicks "Save API Key" button
saveButton.onclick = handleSaveKey;

apiInput.addEventListener("keydown", (event) => {
  // if user pressed Enter key, save API key
  if (event.key === "Enter") {
    // prevent weird default behavior
    event.preventDefault();
    handleSaveKey();
  }
});

// clear all storage of key, report success to user
clearButton.onclick = async () => {
  await clearKey();
  apiInput.value = "";
  rememberCheckbox.checked = false;
  setStatus("Key cleared.");
};

// EXPLANATION MODES UI
// runs when Explanation Modes button clicked
explanationButton.addEventListener("click", () => {
  // toggle visibility on/off
  modesPanel.style.display = (modesPanel.style.display === "none" || !modesPanel.style.display) ? "block" : "none";
});

// select all elements with class mode-button (explanation options)
document.querySelectorAll(".mode-button").forEach((button) => {
  // runs when a mode button is clicked
  button.addEventListener("click", () => {
    // reads data-mode="..." from clicked button (e.g. expert, bullet_points)
    selectedMode = button.dataset.mode;
    setStatus(`Mode: ${selectedMode}`);

    // collapse panel after selection
    modesPanel.style.display = "none";
  });
});

// SUMMARIZATION
// get API key
async function getApiKeyForRequest() {
  // read from UI first (user may input without saving)
  const uiKey = apiInput.value.trim();

  if (uiKey)
    return uiKey;

  // if no key on UI, read from storage
  return await loadKey();
}

// runs when "Summarize Page" button is clicked
extractButton.onclick = async () => {
  setStatus("Preparing...");
  summaryContainer.textContent = "";

  // fetch key, report to user if no key found
  const apiKey = await getApiKeyForRequest();
  if (!apiKey) {
    setStatus("No API key available. Input and save (or keep it session-only).", true);
    return;
  }

  // asks Chrome for the currently active tab in the current window
  // returns array of tabs (we only asked for one)
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  // account for when there's no tabs (edge case)
  if (!tab?.id) {
    setStatus("No active tab found.", true);
    return;
  }

  try {
    // inject content script on demand (safer than randomly doing it on its own)
    await crhome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content/content.js"]
    });
  }
  catch (e) {
    console.error(e);
    setStatus("Could not inject content script on this page.", true);
    return;
  }

  // extracts page content (content script listens for this message)
  chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" }, async (response) => {
    // show error if message failed (script not injected, no response, etc.)
    if (chrome.runtime.lastError || !response?.extracted){
      console.error(chrome.runtime.lastError);
      setStatus("Failed to extract page content.", true);
      return;
    }

    setStatus("Summarizing...");

    // call backend
    try {
      const res = await fetch("http://127.0.0.1:8000/summarize", {
        // send POST with JSON
        method: "POST",
        headers: {"Content-Type": "application/json"},
        // send extracted content, API key, and mode
        body: JSON.stringify({
          content: response.extracted,
          apiKey,
          mode: selectedMode,
        }),
      });

      // parse JSON response, put summary in popup
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.detail || "Backend error.", true);
        return;
      }

      summaryContainer.textContent = data.summary || "(No summary returned.)";
      setStatus("Done.");
    }
    // if fetch fails, log error and show message in popup
    catch (err) {
      console.error(err);
      setStatus("Error contacting backend.", true);
    }
  });
};