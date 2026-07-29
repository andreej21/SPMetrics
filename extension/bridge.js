/**
 * Runs in the ISOLATED world. Bridges page-world findings (from inject.js) to
 * the background service worker, which keeps per-tab state.
 */
window.addEventListener("__SPM_HELPER__", function (e) {
  let msg;
  try {
    msg = JSON.parse(e.detail);
  } catch (_) {
    return;
  }
  try {
    chrome.runtime.sendMessage({ source: "spm-helper", payload: msg });
  } catch (_) {
    // service worker may be asleep; it will get the next tick's scan
  }
});
