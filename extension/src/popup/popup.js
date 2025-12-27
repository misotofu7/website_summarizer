// console.log("Sending mesasage to content script");

const apiInput = document.getElementById("api-key");
const saveButton = document.getElementById("save-api-button");
const extractButton = document.getElementById("extract");
const summaryContainer = document.getElementById("summary-container");

saveButton.onclick = () => {
  const key = apiInput.value.trim();

  if (!key.startsWith("sk-")) {
    alert("Invalid API key. Please try again.");
    return;
  }

  // save to local storange
  chrome.storage.local.set({ openaiApiKey: key }, () => {
    alert("API key saved successfully!");
    apiInput.value = "";
  });
};

// use key when summarizing
extractButton.onclick = async () => {
  chrome.storage.local.get(["openaiApiKey"], async (result) => {
    if (!result.openaiApiKey) {
      alert("Please save your OpenAI API key first.");
      return;
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // extracts page content
    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" }, async (response) => {
      if (chrome.runtime.lastError || !response){
        summaryContainer.innerText = "Failed to extract page content.";
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/summarize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: response.extracted,
            apiKey: result.openaiApiKey,
            mode: "default",
          }),
        });

        const data = await res.json();
        summaryContainer.innerText = data.summary;
      }
      catch (err) {
        console.error(err);
        summaryContainer.innerText = "Error contacting backend.";
      }
    });
  });
};

chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" }, async (response) => {
  try {
    const res = await fetch("http://127.0.0.1:8000/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: response.extracted })
    });
    const data = await res.json();
    summaryContainer.innerText = data.summary; // display in popup
  }
  catch (err) {
    summaryContainer.innerText = "Error fetching summary.";
    console.error(err);
  }
});

const modesPanel = document.getElementById("modes-panel");
const explanationButton = document.getElementById("explanation-modes");

// toggle modes panel --> visibility
explanationButton.addEventListener("click", () => {
  if (modesPanel.style.display === "none") {
    modesPanel.style.display = "block";
  }
  else {
    modesPanel.style.display = "none";
  }
});

// keep track of selected mode by storing it (default mode)
let selectedMode = "like_i_am_5";

// mode button click changes
document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedMode = button.dataset.mode;
    console.log("Selecte mode: ", selectedMode);

    // collapse panel after selection
    modesPanel.style.display = "none";
  });
});

// extract button
document.getElementById("extract").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true});

  chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE"}, async (response) => {
    if (chrome.runtime.lastError) {
      console.error("Message error: ", chrome.runtime.lastError.message);
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: response.extracted, mode: selectedMode })
      });
      const data = await res.json();
      document.getElementById("summary-container").innerText = data.summary; // display in popup
    }
    catch (err) {
      console.error(err);
      document.getElementById("summary-container").innerText = "Error fetching summary.";
    }
  });
});