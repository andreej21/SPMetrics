/**
 * Runs in the PAGE (MAIN world) at document_start.
 *
 * Two jobs:
 *   1. Detect the SPMetrics pixel — the global `sp()`, the px.js <script>, and
 *      the first-party `sp_vid` cookie.
 *   2. Hook fetch() and sendBeacon() so we can see events being sent to the
 *      collector (/api/collect) in real time, including the token + attribution.
 *
 * Findings are handed to the isolated content script via a CustomEvent carrying
 * a JSON string (strings cross the world boundary cleanly).
 */
(function () {
  const COLLECT_PATH = "/api/collect";
  const GLOBAL = "sp";
  const EVT = "__SPM_HELPER__";

  function emit(type, data) {
    try {
      window.dispatchEvent(new CustomEvent(EVT, { detail: JSON.stringify({ type, data, t: Date.now() }) }));
    } catch (_) {}
  }

  function readCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function scan() {
    let pxSrc = null;
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i].src || "";
      if (/\/px\.js(\?|$)/.test(s)) { pxSrc = s; break; }
    }
    emit("detect", {
      hasGlobal: typeof window[GLOBAL] === "function",
      pxSrc: pxSrc,
      collectorOrigin: pxSrc ? new URL(pxSrc).origin : null,
      cookie: readCookie("sp_vid"),
    });
  }

  function handleBody(text, url) {
    try {
      const json = JSON.parse(text);
      if (!json || !json.events) return;
      emit("collect", {
        url: url,
        token: json.token || null,
        landingPage: json.landingPage || null,
        events: (json.events || []).map(function (e) {
          return { type: e.type, name: e.name || null, hasOrder: !!e.order };
        }),
      });
    } catch (_) {}
  }

  function readBody(body, url) {
    if (body == null) return;
    if (typeof body === "string") return handleBody(body, url);
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      body.text().then(function (t) { handleBody(t, url); }).catch(function () {});
      return;
    }
    try { handleBody(JSON.stringify(body), url); } catch (_) {}
  }

  // Hook fetch
  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.indexOf(COLLECT_PATH) !== -1 && init && init.body) readBody(init.body, url);
      } catch (_) {}
      return origFetch.apply(this, arguments);
    };
  }

  // Hook sendBeacon
  const origBeacon = navigator.sendBeacon;
  if (typeof origBeacon === "function") {
    navigator.sendBeacon = function (url, data) {
      try {
        if (String(url).indexOf(COLLECT_PATH) !== -1) readBody(data, String(url));
      } catch (_) {}
      return origBeacon.apply(navigator, arguments);
    };
  }

  // Detect now and a few times after load (px.js loads async; sp appears late).
  scan();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  }
  let ticks = 0;
  const iv = setInterval(function () {
    scan();
    if (++ticks >= 10) clearInterval(iv);
  }, 1000);
})();
