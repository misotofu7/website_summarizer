console.log("popup.js loaded", window.location.href);

// grab DOM elements from popup.html
const apiInput = document.getElementById("api-key");
const saveButton = document.getElementById("save-api-key");
const extractButton = document.getElementById("extract");
const summaryContainer = document.getElementById("summary-container");

// for debugging purposes, ensure all elements exist
if (!saveButton || !extractButton || !apiInput || !summaryContainer) {
  console.error("Popup elements missing — check popup.html IDs");
  throw new Error("Missing popup DOM elements");
}

// save API key by pressing enter button
function saveApiKey() {
  // read input value and trims whitespace
  const key = apiInput.value.trim();

  // OpenAI keys start with "sk-"
  if (!key.startsWith("sk-")) {
    // alert and exit early when input is invalid
    alert("Invalid API key. Please try again.");
    return;
  }

  // save to local storage under name of openaiApiKey
  chrome.storage.local.set({ openaiApiKey: key }, () => {
    // once saved, alert success to user and clear input box
    alert("API key saved successfully!");
    apiInput.value = "";
  });
}

// runs when user clicks "Save API Key" button
saveButton.onclick = saveApiKey;

apiInput.addEventListener("keydown", (event) => {
  // if user pressed Enter key, save API key
  if (event.key === "Enter") {
    // prevent weird default behavior
    event.preventDefault();
    saveApiKey();
  }
});

// set default mode when popup opens
let selectedMode = "like_i_am_5";

// runs when "Summarize Page" button is clicked
extractButton.onclick = async () => {
  console.log("Summarize clicked");
  
  // reads saved API key from local storage
  chrome.storage.local.get(["openaiApiKey"], async (result) => {
    // if no key saved, alert user and exit early
    if (!result.openaiApiKey) {
      alert("Please save your OpenAI API key first.");
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
      summaryContainer.innerText = "No active tab found.";
      return;
    }

    // extracts page content (content script listens for this message)
    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" }, async (response) => {
      // show error if message failed (script not injected, no response, etc.)
      if (chrome.runtime.lastError || !response){
        summaryContainer.innerText = "Failed to extract page content.";
        return;
      }

      // call backend
      try {
        summaryContainer.innerText = "Summarizing…";
        const res = await fetch("http://127.0.0.1:8000/summarize", {
          // send POST with JSON
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // send extracted content, API key, and mode
          body: JSON.stringify({
            content: response.extracted,
            apiKey: result.openaiApiKey,
            mode: selectedMode,
          }),
        });

        // parse JSON response, put summary in popup
        const data = await res.json();
        summaryContainer.innerText = data.summary;
      }
      // if fetch fails, log error and show message in popup
      catch (err) {
        console.error(err);
        summaryContainer.innerText = "Error contacting backend.";
      }
    });
  });
};

// grap DOM elements for explanation modes
const modesPanel = document.getElementById("modes-panel");
const explanationButton = document.getElementById("explanation-modes");

// ensure DOM elements exist
if (!modesPanel || !explanationButton) {
  console.error("Modes panel elements missing — check popup.html IDs");
  throw new Error("Missing DOM elements modesPanel or explanationButton!");
}

// runs when Explanation Modes button clicked
explanationButton.addEventListener("click", () => {
  // toggle visibility on/off
  if (modesPanel.style.display === "none") {
    modesPanel.style.display = "block";
  }
  else {
    modesPanel.style.display = "none";
  }
});

// select all elements with class mode-button (explanation options)
document.querySelectorAll(".mode-button").forEach((button) => {
  // runs when a mode button is clicked
  button.addEventListener("click", () => {
    // reads data-mode="..." from clicked button (e.g. expert, bullet_points)
    selectedMode = button.dataset.mode;
    console.log("Selected mode: ", selectedMode);

    // collapse panel after selection
    modesPanel.style.display = "none";
  });
});