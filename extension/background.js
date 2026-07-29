/**
 * Service worker: keeps per-tab pixel state in chrome.storage.session (survives
 * SW restarts, cleared when the browser closes), drives the toolbar badge, and
 * answers the popup's state queries.
 */
const key = (tabId) => "tab_" + tabId;

async function getState(tabId) {
  const k = key(tabId);
  const o = await chrome.storage.session.get(k);
  return o[k] || { detect: null, collects: [] };
}
async function setState(tabId, st) {
  await chrome.storage.session.set({ [key(tabId)]: st });
}

function present(st) {
  return !!(st.detect && (st.detect.hasGlobal || st.detect.pxSrc));
}

async function updateBadge(tabId, st) {
  const on = present(st);
  const n = st.collects.length;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: on ? "#16a34a" : "#9ca3af" });
  await chrome.action.setBadgeText({ tabId, text: on ? (n ? String(Math.min(n, 99)) : "on") : "" });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Popup asking for a tab's state
  if (msg && msg.query === "state") {
    getState(msg.tabId).then(sendResponse);
    return true; // async response
  }
  // Findings from a content script
  if (msg && msg.source === "spm-helper" && sender.tab) {
    const tabId = sender.tab.id;
    (async () => {
      const st = await getState(tabId);
      const p = msg.payload;
      if (p.type === "detect") {
        st.detect = p.data;
      } else if (p.type === "collect") {
        st.collects.push(Object.assign({ t: p.t }, p.data));
        if (st.collects.length > 50) st.collects.shift();
      }
      await setState(tabId, st);
      await updateBadge(tabId, st);
    })();
  }
});

// Reset a tab's state when it navigates to a new page.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && changeInfo.url) {
    setState(tabId, { detect: null, collects: [] });
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(key(tabId));
});
