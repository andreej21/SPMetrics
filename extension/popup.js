/**
 * Popup — Triple-Whale-style pixel helper.
 * Shows the pixel info block + a live, expandable list of events with a
 * Valid/Invalid status, timestamp, and the parameters each event carried.
 */
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

// Pretty labels + icons per event type (mirrors how TW labels "Page Load").
const META = {
  page_view:        { label: "Page Load" },
  product_view:     { label: "Product View" },
  collection_view:  { label: "Collection View" },
  search:           { label: "Search" },
  add_to_cart:      { label: "Add to Cart" },
  remove_from_cart: { label: "Remove from Cart" },
  checkout_started: { label: "Checkout Started" },
  checkout_step:    { label: "Checkout Step" },
  purchase:         { label: "Purchase" },
  identify:         { label: "Identify" },
  custom:           { label: "Custom" },
};

// Validate an event's shape → the green/amber/red status like TW's "Valid".
function validate(e) {
  const p = e.props || {};
  switch (e.type) {
    case "purchase":
      if (!e.order || !(e.order.totalAmount > 0)) return { s: "invalid", t: "Missing order total" };
      return { s: "valid", t: "Valid" };
    case "product_view":
    case "add_to_cart":
    case "remove_from_cart":
      if (!p.productId) return { s: "warn", t: "No productId" };
      return { s: "valid", t: "Valid" };
    case "identify":
      if (!e.email && !(p && p.email)) return { s: "warn", t: "No email/id" };
      return { s: "valid", t: "Valid" };
    default:
      return { s: "valid", t: "Valid" };
  }
}

function hhmm(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function tokenOf(st) {
  if (st && st.detect && st.detect.token) return st.detect.token;
  for (const c of (st && st.collects) || []) if (c.token) return c.token;
  return null;
}

function present(st) { return !!(st && st.detect && (st.detect.hasGlobal || st.detect.pxSrc)); }

/* ── render: pixel info block ─────────────────────────────── */
function renderPixel(st) {
  const on = present(st);
  const d = (st && st.detect) || {};
  const token = tokenOf(st);
  el("pixelStatus").innerHTML =
    `<span class="pill ${on ? "ok" : "no"}">${on ? "Pixel detected" : "No SPMetrics pixel"}</span>` +
    (on
      ? `<dl>
          <dt>Pixel id</dt><dd>${esc(token || "—")}</dd>
          <dt>Version</dt><dd>${esc(d.version || "unknown")}</dd>
          <dt>Platform</dt><dd>${esc((d.platform || "web").toUpperCase())}</dd>
          <dt>Is Headless</dt><dd>${d.headless === null || d.headless === undefined ? "—" : String(d.headless)}</dd>
          <dt>Collector</dt><dd>${esc(d.collectorOrigin || "—")}</dd>
          <dt>Visitor id</dt><dd>${esc(d.cookie || "(no sp_vid cookie yet)")}</dd>
        </dl>`
      : `<dl><dt>Checked</dt><dd>sp(), px.js, sp_vid cookie</dd></dl>`);
}

/* ── render: troubleshoot checklist ───────────────────────── */
function renderDiag(st) {
  const d = (st && st.detect) || {};
  const collects = (st && st.collects) || [];
  const checks = [
    ["px.js script loaded", !!d.pxSrc],
    ["sp() global present", !!d.hasGlobal],
    ["Pixel initialized (token)", !!tokenOf(st)],
    ["First-party cookie (sp_vid)", !!d.cookie],
    ["Events sending", collects.length > 0],
  ];
  el("diag").innerHTML = checks
    .map(
      ([label, ok]) =>
        `<li><span style="font-weight:700;color:${ok ? "#16a34a" : "#dc2626"}">${ok ? "PASS" : "FAIL"}</span>` +
        `<span>${esc(label)}</span></li>`,
    )
    .join("");
}

/* ── render: event cards ──────────────────────────────────── */
const openKeys = new Set();

function renderEvents(st) {
  const collects = (st && st.collects) || [];
  const flat = [];
  collects.forEach((c, ci) => {
    (c.events || []).forEach((e, ei) => flat.push({ e, batch: c, key: ci + ":" + ei + ":" + e.type }));
  });

  if (flat.length === 0) {
    el("events").innerHTML = "";
    el("empty").hidden = false;
    return;
  }
  el("empty").hidden = true;

  el("events").innerHTML = flat
    .slice(-60)
    .reverse()
    .map(({ e, batch, key }) => {
      const m = META[e.type] || { label: e.name || e.type };
      const label = e.type === "custom" && e.name ? e.name : m.label;
      const v = validate(e);
      const time = hhmm(e.ts || batch.t);
      const isOpen = openKeys.has(key);

      const params = [];
      params.push(["Url", e.eventUrl || batch.landingPage || batch.url || "—"]);
      if (e.path) params.push(["Path", e.path]);
      const p = e.props || {};
      if (p.productId) params.push(["Product", p.productId + (p.title ? " · " + p.title : "")]);
      if (p.price != null) params.push(["Price", "$" + (Number(p.price) / 100).toFixed(2)]);
      if (p.qty != null) params.push(["Qty", String(p.qty)]);
      if (p.value != null) params.push(["Value", "$" + (Number(p.value) / 100).toFixed(2)]);
      if (e.email) params.push(["Email", e.email]);
      if (e.order) {
        params.push(["Order", e.order.orderNumber || e.order.externalOrderId || "—"]);
        if (e.order.totalAmount != null)
          params.push(["Total", "$" + (Number(e.order.totalAmount) / 100).toFixed(2) + " " + (e.order.currency || "")]);
      }
      if (batch.token) params.push(["Token", batch.token]);

      return (
        `<details class="ev" data-key="${esc(key)}"${isOpen ? " open" : ""}>` +
        `<summary>` +
        `<span class="dot ${v.s}"></span>` +
        `<span class="nm">${esc(label)}</span>` +
        `<span class="st ${v.s}">${esc(v.t)}</span>` +
        `<span class="time">${esc(time)}</span>` +
        `</summary>` +
        `<div class="params"><h4>Received Parameters</h4><dl>` +
        params.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("") +
        `</dl></div></details>`
      );
    })
    .join("");

  // track expand/collapse so live refresh preserves open state
  el("events").querySelectorAll("details.ev").forEach((d) => {
    d.addEventListener("toggle", () => {
      const k = d.getAttribute("data-key");
      if (d.open) openKeys.add(k); else openKeys.delete(k);
    });
  });
}

/* ── wiring: target tab, live refresh, buttons ────────────── */
function getTargetTabId(cb) {
  const q = new URLSearchParams(location.search);
  const forced = q.get("tabId");
  if (forced) return cb(Number(forced));
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs[0] && tabs[0].id));
}

function refresh() {
  getTargetTabId((tabId) => {
    if (tabId == null) return;
    chrome.runtime.sendMessage({ query: "state", tabId }, (st) => {
      renderPixel(st);
      renderDiag(st);
      renderEvents(st);
    });
  });
}

el("troubleshoot").addEventListener("click", () => el("diag").classList.toggle("show"));

el("popout").addEventListener("click", () => {
  getTargetTabId((tabId) => {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html") + "?tabId=" + tabId,
      type: "popup",
      width: 420,
      height: 680,
    });
  });
});

refresh();
setInterval(refresh, 1000); // live-update so events appear without reopening
