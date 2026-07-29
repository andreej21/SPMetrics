/**
 * SPMetrics — first-party browser tracker.
 *
 * Loaded once per storefront. Drains the command queue set up by the inline
 * loader snippet, then exposes the real `sp(...)` dispatcher.
 *
 * Design goals mirror Triple Whale's pixel:
 *   • First-party: visitor id lives in localStorage + a first-party cookie the
 *     collector sets, so it survives Safari ITP and most ad-blockers.
 *   • Resilient delivery: events are batched and flushed with sendBeacon /
 *     fetch(keepalive) so nothing is lost on navigation or tab close.
 *   • SPA-aware: auto page views on history navigation, not just first load.
 *   • Captures attribution (UTMs, click ids, referrer) at session entry.
 */
(function () {
  type Props = Record<string, unknown>;
  type Cmd = [string, ...unknown[]];

  const KNOWN_TYPES = new Set([
    "page_view",
    "product_view",
    "collection_view",
    "search",
    "add_to_cart",
    "remove_from_cart",
    "checkout_started",
    "checkout_step",
    "purchase",
    "identify",
    "custom",
  ]);

  const LS_ANON = "sp_vid";
  const SS_LANDING = "sp_landing";
  const SS_REFERRER = "sp_referrer";

  const w = window as unknown as {
    sp?: { q?: Cmd[]; (...args: unknown[]): void };
    __opConfig?: Config;
  };

  type Config = { token: string; host: string; autoPageview: boolean };

  const config: Config = {
    token: "",
    // Injected at build time; falls back to the script's own origin.
    host: (document.currentScript as HTMLScriptElement)?.src
      ? new URL((document.currentScript as HTMLScriptElement).src).origin
      : "__COLLECTOR_ORIGIN__",
    autoPageview: true,
  };

  // ── first-party id (best-effort client hint; the collector cookie is authoritative)
  function getAnon(): string | undefined {
    try {
      return localStorage.getItem(LS_ANON) || readCookie(LS_ANON) || undefined;
    } catch {
      return readCookie(LS_ANON) || undefined;
    }
  }
  function setAnon(id: string) {
    try {
      localStorage.setItem(LS_ANON, id);
    } catch {
      /* private mode */
    }
  }
  function readCookie(name: string): string | undefined {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  // ── session entry attribution (captured once per browser session)
  function landing(): { landingPage: string; referrer: string } {
    let lp: string | null = null;
    let rf: string | null = null;
    try {
      lp = sessionStorage.getItem(SS_LANDING);
      rf = sessionStorage.getItem(SS_REFERRER);
      if (!lp) {
        lp = location.href;
        rf = document.referrer || "";
        sessionStorage.setItem(SS_LANDING, lp);
        sessionStorage.setItem(SS_REFERRER, rf);
      }
    } catch {
      lp = location.href;
      rf = document.referrer || "";
    }
    return { landingPage: lp || location.href, referrer: rf || "" };
  }

  // ── event queue + batched delivery
  type Ev = {
    type: string;
    name?: string;
    props?: Props;
    url: string;
    path: string;
    referrer: string;
    ts: number;
    dedupeKey?: string;
    email?: string;
    externalId?: string;
    traits?: Props;
    order?: unknown;
  };

  let buffer: Ev[] = [];
  let flushTimer: number | null = null;

  function enqueue(ev: Ev) {
    buffer.push(ev);
    if (ev.type === "purchase" || buffer.length >= 10) {
      flush();
    } else if (flushTimer == null) {
      flushTimer = window.setTimeout(flush, 2000);
    }
  }

  function flush(useBeacon = false) {
    if (flushTimer != null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (buffer.length === 0 || !config.token) return;

    const batch = buffer;
    buffer = [];
    const { landingPage, referrer } = landing();
    const payload = JSON.stringify({
      token: config.token,
      anonId: getAnon(),
      landingPage,
      referrer,
      events: batch,
    });
    const url = config.host + "/api/collect";

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "include", // round-trip the first-party cookie
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.visitorId) setAnon(res.visitorId);
      })
      .catch(() => {
        // put events back so the next flush retries
        buffer = batch.concat(buffer);
      });
  }

  // ── public command handlers
  function track(nameOrType: string, props?: Props) {
    const type = KNOWN_TYPES.has(nameOrType) ? nameOrType : "custom";
    enqueue({
      type,
      name: type === "custom" ? nameOrType : undefined,
      props: props || {},
      url: location.href,
      path: location.pathname,
      referrer: document.referrer || "",
      ts: Date.now(),
      dedupeKey: (props && (props._id as string)) || undefined,
      order: type === "purchase" ? props?.order : undefined,
    });
  }

  function page(props?: Props) {
    track("page_view", { title: document.title, ...(props || {}) });
  }

  function identify(traits: { email?: string; externalId?: string } & Props) {
    enqueue({
      type: "identify",
      email: traits.email,
      externalId: traits.externalId,
      traits,
      url: location.href,
      path: location.pathname,
      referrer: document.referrer || "",
      ts: Date.now(),
    });
  }

  function init(token: string, opts?: Partial<Config>) {
    config.token = token;
    if (opts?.host) config.host = opts.host;
    if (opts && typeof opts.autoPageview === "boolean") config.autoPageview = opts.autoPageview;
    if (config.autoPageview) {
      page();
      hookSpaNavigation();
    }
  }

  // Auto page views on SPA route changes.
  function hookSpaNavigation() {
    const fire = () => page();
    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function (...a: Parameters<typeof push>) {
      const r = push.apply(this, a);
      fire();
      return r;
    };
    history.replaceState = function (...a: Parameters<typeof replace>) {
      const r = replace.apply(this, a);
      fire();
      return r;
    };
    window.addEventListener("popstate", fire);
  }

  // Flush pending events when the page is being hidden/unloaded.
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });

  // ── dispatcher + queue drain
  function dispatch(...args: unknown[]) {
    const [cmd, ...rest] = args as Cmd;
    switch (cmd) {
      case "init":
        return init(rest[0] as string, rest[1] as Partial<Config>);
      case "track":
        return track(rest[0] as string, rest[1] as Props);
      case "page":
        return page(rest[0] as Props);
      case "identify":
        return identify(rest[0] as { email?: string });
      default:
        // ignore unknown commands
        return;
    }
  }

  const queued: Cmd[] = (w.sp && w.sp.q) || [];
  w.sp = dispatch as typeof w.sp;
  queued.forEach((c) => dispatch(...(c as unknown[])));
})();
