// prove that content script is injected into page
console.log("Content script loaded");

// check if element is visible
// use to ignore hidden elements (ads, collapsed menus, etc.)
// DOM element el
function isVisible(el) {
  // ask browser for final computed CSS style of element after all CSS rules applied
  const style = window.getComputedStyle(el);
  // return true if element is visible
  return style && style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
}

// get headings and paragraphs
function extractReadableText() {
  // all set of tags to ignore completely while extracting
  const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "NAV", "FOOTER", "HEADER", "ASIDE", "FORM"]);
  // result array to hold extracted content
  const result = [];
  // create tree walker to traverse DOM
  const walker = document.createTreeWalker(
    // start walking from document.body (visible page content)
    document.body,
    // only visit element nodes, not text nodes/comments
    NodeFilter.SHOW_ELEMENT,
    {
      // function deciding whether element should be included or skipped
      acceptNode(node) {
        if (ignoredTags.has(node.tagName))
          return NodeFilter.FILTER_REJECT;
        if (!isVisible(node))
          return NodeFilter.FILTER_REJECT;
        // only accept if it isn't an ignore tag and is visible
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // move walker to next element node each time
  while (walker.nextNode()) {
    // store current DOM element in el
    const el = walker.currentNode;
    // if it's a header tag (from h1 to h6)
    if (/^H[1-6]$/.test(el.tagName)) {
      // add object to results list with type heading, level, and text
      result.push({ type: "heading", level: Number(el.tagName[1]), text: el.innerText.trim() });
    }
    // if it's a paragraph tag
    else if (el.tagName === "P") {
      // trim whitespace and get text
      const text = el.innerText.trim();
      // add to results list if text is longer than 40 characters
      if (text.length > 40)
        result.push({ type: "paragraph", text });
    }
  }

  return result;
}

// look for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // message for debugging
    console.log("Message received in content script");
    // if asking for page extraction
    if (message.type === "EXTRACT_PAGE") {
      // run extraction function and store result
      const extracted = extractReadableText();
      // send response back to sender
      sendResponse({ extracted });
    }
  // return true to tell Chrome to keep message channel open for response
  return true;
});