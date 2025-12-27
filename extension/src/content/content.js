console.log("Content script loaded");

// check if element is visible
function isVisible(el) {
  const style = window.getComputedStyle(el);
  return style && style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
}

// get headings and paragraphs
function extractReadableText() {
  const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "NAV", "FOOTER", "HEADER", "ASIDE", "FORM"]);
  const result = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (ignoredTags.has(node.tagName)) return NodeFilter.FILTER_REJECT;
        if (!isVisible(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (/^H[1-6]$/.test(el.tagName)) {
      result.push({ type: "heading", level: Number(el.tagName[1]), text: el.innerText.trim() });
    } else if (el.tagName === "P") {
      const text = el.innerText.trim();
      if (text.length > 40) result.push({ type: "paragraph", text });
    }
  }

  return result;
}

// look for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in content script");
    if (message.type === "EXTRACT_PAGE") {
        const extracted = extractReadableText();
        sendResponse({ extracted });
    }
  return true;
});