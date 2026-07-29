/**
 * Popup: reads the active tab's captured state from the background worker and
 * renders whether the SPMetrics pixel is present, its token/visitor id/collector,
 * and the list of events seen firing on this page.
 */
function el(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function renderStatus(st) {
  const present = !!(st && st.detect && (st.detect.hasGlobal || st.detect.pxSrc));
  const d = (st && st.detect) || {};
  const token = firstToken(st);

  el("status").innerHTML =
    `<span class="pill ${present ? "ok" : "no"}"><span class="dot ${present ? "ok" : "no"}"></span>` +
    `${present ? "Pixel detected" : "No SPMetrics pixel found"}</span>` +
    (present
      ? `<dl>
          <dt>Global sp()</dt><dd>${d.hasGlobal ? "yes" : "no"}</dd>
          <dt>px.js</dt><dd>${d.pxSrc ? "loaded" : "not found"}</dd>
          <dt>Collector</dt><dd>${esc(d.collectorOrigin || "—")}</dd>
          <dt>Pixel token</dt><dd>${esc(token || "—")}</dd>
          <dt>Visitor id</dt><dd>${esc(d.cookie || "(no sp_vid cookie yet)")}</dd>
        </dl>`
      : `<dl><dt>Checked</dt><dd>sp(), px.js, sp_vid cookie</dd></dl>`);
}

function firstToken(st) {
  if (!st || !st.collects) return null;
  for (const c of st.collects) if (c.token) return c.token;
  return null;
}

function renderEvents(st) {
  const list = el("events");
  const collects = (st && st.collects) || [];
  const flat = [];
  for (const c of collects) for (const e of c.events || []) flat.push(e);

  if (flat.length === 0) {
    list.innerHTML = "";
    el("empty").hidden = false;
    return;
  }
  el("empty").hidden = true;
  list.innerHTML = flat
    .slice(-40)
    .reverse()
    .map(
      (e) =>
        `<li><span class="type">${esc(e.type)}${e.name ? " · " + esc(e.name) : ""}</span>` +
        `${e.hasOrder ? '<span class="badge">order</span>' : ""}</li>`,
    )
    .join("");
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return;
  chrome.runtime.sendMessage({ query: "state", tabId: tab.id }, (st) => {
    renderStatus(st);
    renderEvents(st);
  });
});
