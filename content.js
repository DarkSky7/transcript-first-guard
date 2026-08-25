/**
 * Transcript-First & Live Chat Guard — content script
 *
 * Defaults (tunable in the popup / chrome.storage.sync):
 *   openTranscript: true  — open the transcript panel when a watch page loads AND a
 *                           transcript exists for the video.
 *   closeLiveChat:  true  — collapse the live-chat pane when a live/broadcast watch
 *                           page loads.
 *
 * Overrides (per-page, session): the floating control lets the user RE-OPEN the
 * live chat and CLOSE the transcript for the current page. Those choices are kept
 * in sessionStorage for this tab, so subsequent /watch navigations in the same
 * session apply the user's latest preference; a fresh tab falls back to defaults.
 */
(() => {
  if (window.__transcriptFirstLoaded) return;
  window.__transcriptFirstLoaded = true;

  const VERSION = "1.1.21";
  const STORE = { sync: chrome.storage && chrome.storage.sync };
  const FLUID_ID = "tf-gate-root";

  // ── Diagnostics (throttled; console.log AND on-page status readout) ─────
  let lastDiag = 0;
  function diag(...args) {
    const now = Date.now();
    if (now - lastDiag < 1000) return; // max 1 line/sec
    lastDiag = now;
    try { console.log("[TF-guard]", ...args); } catch (_) {}
    // Mirror the FIRST argument into the on-page status readout (no console
    // needed). Callers that want a readable readout pass a compact line first
    // and the full detail object second.
    const st = document.getElementById("tf-status");
    if (st) {
      try { st.textContent = String(args[0] || "").slice(0, 160); } catch (_) {}
    }
  }
  diag("content script loaded v" + VERSION + " — storage:", STORE.sync ? "ok" : "MISSING", "url:", location.href.slice(0, 80));

  // ── Defaults ─────────────────────────────────────────────────────────────
  let DEFAULTS = { openTranscript: true, closeLiveChat: true };
  function loadDefaults() {
    const sync = (chrome.storage && chrome.storage.sync) ? chrome.storage.sync : null;
    if (!sync) { diag("storage unavailable — using defaults"); return; }
    try {
      const r = sync.get(DEFAULTS);
      if (r && typeof r.then === "function") {
        // Promise API (Firefox browser.* and modern Chrome MV3).
        r.then((items) => { DEFAULTS = Object.assign({}, DEFAULTS, items || {}); })
         .catch(() => {});
      } else {
        // Callback API (older Chrome). Callback form is unreliable in Firefox,
        // so we only pass a callback when the promise form was NOT returned.
        sync.get(DEFAULTS, (items) => { DEFAULTS = Object.assign({}, DEFAULTS, items || {}); });
      }
    } catch (e) { diag("storage.get threw:", String(e)); }
  }
  loadDefaults();
  // Reload defaults live when changed in the popup.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (changes.openTranscript) DEFAULTS.openTranscript = changes.openTranscript.newValue;
      if (changes.closeLiveChat) DEFAULTS.closeLiveChat = changes.closeLiveChat.newValue;
    });
  } catch (e) { diag("onChanged listener failed:", String(e)); }

  // sessionStorage keys (scoped to the tab profile via location.host).
  // Getters return undefined when the user has NEVER touched the key — that
  // lets applyPolicy distinguish "follow the popup default" from "user has an
  // explicit session override" (which must always win).
  //
  // An override is the user's EXPLICIT preference and is honored indefinitely
  // — across reloads, SPA navigations, and (via Firefox/Zen session-restore)
  // browser restarts — until the user toggles it again. Values written by
  // legacy builds WITHOUT the matching "At" timestamp are untrusted artifacts
  // and are scrubbed on first read, so a stale flag from an old version can
  // never silently override the defaults.
  function ttlFresh(key) {
    const v = sessionStorage.getItem(key);
    if (v === null) return undefined;
    const at = parseInt(sessionStorage.getItem(key + "At") || "0", 10);
    if (!at) {
      // Legacy value: not a real user preference — clear it.
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(key + "At");
      return undefined;
    }
    return v === "1";
  }
  function ttlSet(key, v) {
    sessionStorage.setItem(key, v ? "1" : "0");
    sessionStorage.setItem(key + "At", String(Date.now()));
  }
  const SESSION = {
    get liveChatUnlocked() { return ttlFresh("tfg.liveChatUnlocked"); },
    set liveChatUnlocked(v) { ttlSet("tfg.liveChatUnlocked", v); },
    get transcriptClosed() { return ttlFresh("tfg.transcriptClosed"); },
    set transcriptClosed(v) { ttlSet("tfg.transcriptClosed", v); },
  };

  function isWatchPage() {
    const p = location.pathname;
    return p === "/watch" || p === "/live" || p.startsWith("/watch") || p.startsWith("/live");
  }

  // ── Selectors (YouTube DOM, current + tolerant) ──────────────────────────
  const SELECTORS = {
    // Engagement panel holding the transcript.
    transcriptPanel: 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
    // Live chat container(s).
    liveChatFrame: "ytd-live-chat-frame",
    liveChatRenderer: "yt-live-chat-renderer",
    liveChatContainer: "#chat-container, ytd-app [id*='chat'], ytd-live-chat-frame #panel-pages",
    // The chat's top-level column wrapper we can hide.
    chatColumn: "ytd-watch-flexy #columns ytd-item-section-renderer, #chat",
  };

  function q(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  // ── Transcript toggle finders ───────────────────────────────────────────
  // The toggle's OWN aria-label is the authoritative state: "Show transcript"
  // = closed, "Hide transcript" = open. NEVER click one labeled "Hide" from
  // the open path (that would toggle an open transcript shut and can put
  // YouTube's state machine in a loop) and vice versa for the close path.
  //
  // Layered lookup: (1) fast light-DOM scans — description-section button,
  // then ANY element whose aria-label matches (some layouts render the
  // affordance as a div/menu item), then buttons whose TEXT matches (no
  // aria-label); (2) a memoized deep walk that also pierces OPEN SHADOW
  // ROOTS — Firefox renders some YouTube web components inside shadow DOM,
  // invisible to document.querySelector. The deep walk runs at most once per
  // applyPolicy pass and only when the light scans miss.
  const TX_SHOW_RE = /show transcript/i;
  const TX_HIDE_RE = /hide transcript/i;
  const PANEL_SEL = 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';

  let deepTx = null; // per-applyPolicy memo: { show, hide, panel }
  let lastDeepWalk = 0;
  function deepFindTx() {
    if (deepTx) return deepTx;
    const now = Date.now();
    if (now - lastDeepWalk < 2000) {
      // Throttle: during boot, applyPolicy can fire ~2/sec, and the deep walk
      // touches .shadowRoot on many nodes — on Zen's wrapped DOM that is far
      // too expensive to run every pass (it starved the page's boot scripts
      // and stalled the load event in 1.1.17). Light-DOM-only until the next
      // window.
      deepTx = { show: null, hide: null, panel: null };
      return deepTx;
    }
    lastDeepWalk = now;
    deepTx = { show: null, hide: null, panel: null };
    const walk = (root) => {
      if (!deepTx.panel) deepTx.panel = root.querySelector(PANEL_SEL);
      root.querySelectorAll("[aria-label*='ranscript']").forEach((n) => {
        const aria = n.getAttribute("aria-label") || "";
        if (!deepTx.show && TX_SHOW_RE.test(aria)) deepTx.show = n;
        if (!deepTx.hide && TX_HIDE_RE.test(aria)) deepTx.hide = n;
      });
      root.querySelectorAll("button, tp-yt-paper-button, ytd-menu-service-item-renderer").forEach((n) => {
        const t = (n.textContent || "").trim();
        if (!deepTx.show && TX_SHOW_RE.test(t)) deepTx.show = n;
        if (!deepTx.hide && TX_HIDE_RE.test(t)) deepTx.hide = n;
      });
      // Only custom elements can host YouTube's shadow DOM. CSS has no
      // wildcard type selector, so find them with XPath (native, fast) —
      // scanning "*" and reading .shadowRoot on every node is the stall.
      const hosts = document.evaluate(
        ".//*[starts-with(local-name(),'ytd-') or starts-with(local-name(),'tp-yt-')]",
        root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
      );
      for (let i = 0; i < hosts.snapshotLength; i++) {
        const el = hosts.snapshotItem(i);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return deepTx;
  }

  function lightFind(re) {
    const all = qa("button, tp-yt-paper-button");
    let b = all.find((x) => re.test(x.getAttribute("aria-label") || "")) || null;
    if (!b) {
      // Non-button affordance (some layouts render it as a div/menu item).
      b = qa("[aria-label*='ranscript']").find((x) => re.test(x.getAttribute("aria-label") || "")) || null;
    }
    if (!b) {
      // Button without an aria-label, matched by its own text.
      b = all.find((x) => re.test((x.textContent || "").trim())) || null;
    }
    return b;
  }

  function transcriptBtn() {
    const desc = q("ytd-video-description-transcript-section-renderer button");
    if (desc && TX_SHOW_RE.test(desc.getAttribute("aria-label") || "")) return desc;
    return lightFind(TX_SHOW_RE) || deepFindTx().show;
  }

  function transcriptHideBtn() {
    const desc = q("ytd-video-description-transcript-section-renderer button");
    if (desc && TX_HIDE_RE.test(desc.getAttribute("aria-label") || "")) return desc;
    return lightFind(TX_HIDE_RE) || deepFindTx().hide;
  }

  function transcriptEnabled() {
    // True if a transcript affordance exists (a captioned video shows the
    // "Show transcript" button). Fall back to the panel being present.
    return Boolean(transcriptBtn()) || Boolean(q(PANEL_SEL)) || Boolean(deepFindTx().panel);
  }

  function isTranscriptOpen() {
    // What the user actually sees: the panel is open iff it is VISIBLE on
    // screen. YouTube hides a fresh, not-yet-opened panel via stylesheet
    // rules (the `hidden` attribute is often absent in Zen), and our own
    // user-close sets inline display:none — computed style captures all of
    // it. The button label is advisory only (it can lag the panel).
    const panel = q(PANEL_SEL) || deepFindTx().panel;
    if (!panel) return false;
    try {
      const cs = getComputedStyle(panel);
      return cs.display !== "none" && cs.visibility !== "hidden";
    } catch (_) { return false; }
  }

  // We set this whenever closeTranscript forces the panel closed (inline
  // display + hidden attribute). openTranscript uses it to know it may strip
  // those artifacts — it must NEVER touch the panel on a page where YouTube
  // owns the attributes (a fresh load), or YouTube's boot stalls.
  let weClosed = false;

  function openTranscript(forceUnmask) {
    // Remove OUR close artifacts FIRST — the `hidden` attribute and any forced
    // inline display — so YouTube's own open can take visual effect again.
    // YouTube's state machine knows nothing about the `hidden` attribute we
    // set at close, and its author CSS keeps `[hidden]` panels hidden even
    // after it "opens" the panel (that was the 1.1.15 reopen failure).
    const panel = q(PANEL_SEL) || deepFindTx().panel;
    if (panel && weClosed) {
      // Remove only the artifacts WE created at close. YouTube's own `hidden`
      // attribute on a fresh page belongs to its state machine — never touch
      // it (stripping it mid-boot stalls the page, seen in 1.1.16).
      if (panel.hasAttribute("hidden")) panel.removeAttribute("hidden");
      if (panel.style.display) panel.style.removeProperty("display");
      weClosed = false;
    }
    const showBtn = transcriptBtn();
    if (showBtn && !isTranscriptOpen()) {
      diag("open: clicking show-transcript button");
      try { showBtn.click(); } catch (e) { diag("open: click threw", String(e)); }
      return;
    }
    if (isTranscriptOpen()) return;
    const hideBtn = transcriptHideBtn();
    if (hideBtn) {
      // Desync: YouTube's label says "Hide" (it thinks the panel is open) but
      // the panel is not visible. Clicking the toggle flips its state → open.
      diag("open: desync — clicking hide-labeled toggle");
      try { hideBtn.click(); } catch (_) {}
      return;
    }
    if (forceUnmask && panel && !isTranscriptOpen()) {
      // No toggle at all (or clicks are being ignored) and the user explicitly
      // asked to open: force-show the panel. Manual opens only — the auto-open
      // path never fights YouTube's state machine.
      diag("open: no toggle — force-unmasking panel (manual)");
      panel.removeAttribute("hidden");
      panel.style.removeProperty("display");
    }
  }

  function closeTranscript() {
    // Close via YouTube's OWN toggle when available (keeps its label in sync).
    // THEN force the visual close: YouTube's author CSS overrides the UA
    // `[hidden]` rule on custom elements, so the `hidden` attribute alone is
    // unreliable (seen in Zen — panel stayed visible). The forced inline
    // display:none is the same guaranteed mechanism the live-chat collapse
    // uses, and works even when YouTube's label is desynced.
    if (!isTranscriptOpen()) return; // already closed — never click (would OPEN)
    const hideBtn = transcriptHideBtn();
    if (hideBtn) {
      try { hideBtn.click(); } catch (_) {}
    }
    const panel = q(PANEL_SEL) || deepFindTx().panel;
    if (panel) {
      panel.setAttribute("hidden", "");
      panel.style.setProperty("display", "none", "important");
      weClosed = true; // reopen may now strip these artifacts
    }
  }

  function liveChatRoot() {
    return q(SELECTORS.liveChatFrame) || q(SELECTORS.liveChatRenderer) ||
           q(SELECTORS.liveChatContainer);
  }

  function hasLiveChat() {
    return Boolean(liveChatRoot());
  }

  function collapseLiveChat() {
    const root = liveChatRoot();
    if (root) {
      root.style.setProperty("display", "none", "important");
    }
    // The float button is the re-enable mechanism; ensure it is mounted.
    ensureFloatUI();
  }

  function restoreLiveChat() {
    const roots = [q(SELECTORS.liveChatFrame), q(SELECTORS.liveChatRenderer), q(SELECTORS.liveChatContainer)];
    for (const r of roots) {
      if (r) r.style.setProperty("display", "");
    }
    const frame = q(SELECTORS.liveChatFrame);
    if (frame) frame.style.setProperty("display", "");
  }

  // ── Floating control ─────────────────────────────────────────────────────
  function ensureFloatUI() {
    if (document.getElementById(FLUID_ID)) return;
    const host = document.createElement("div");
    host.id = FLUID_ID;
    host.innerHTML = `
      <div class="tf-card">
        <button id="tf-open-chat" title="Toggle live chat on this page (affects current and subsequent pages this session)">🡹 Live Chat</button>
        <button id="tf-close-tx" title="Toggle transcript — close or re-open (current + subsequent pages this session)">✕ Transcript</button>
      </div>`;
    (document.body || document.documentElement).appendChild(host);

    host.querySelector("#tf-open-chat").addEventListener("click", () => {
      // Toggle: unlocking sets the session override; clicking again re-locks.
      SESSION.liveChatUnlocked = !(SESSION.liveChatUnlocked === true);
      setChatBtnState(SESSION.liveChatUnlocked === true);
      applied.chat = null; // force re-evaluation of the chat state
      applyPolicy();
    });
    host.querySelector("#tf-close-tx").addEventListener("click", () => {
      // Flip the transcript's ACTUAL state in one click (the label shows the
      // action): closed → open, open → closed. The result becomes the session
      // override. User-requested opens bypass the auto-open rate limit.
      const willOpen = !isTranscriptOpen();
      SESSION.transcriptClosed = !willOpen;
      applied.tx = null; // force re-evaluation of the transcript state
      applyPolicy(willOpen ? { userOpen: true } : undefined);
    });
  }

  function setChatBtnState(unlocked) {
    const b = document.querySelector("#tf-open-chat");
    if (!b) return;
    // Idempotent: only mutate when the state actually changes, so we never
    // re-trigger the MutationObserver in a loop.
    if (String(b.dataset.unlocked) === String(unlocked)) return;
    b.dataset.unlocked = String(unlocked);
    b.classList.toggle("active", unlocked);
    b.textContent = unlocked ? "🡻 Live Chat" : "🡹 Live Chat";
  }

  function setTxBtnState(closed) {
    const b = document.querySelector("#tf-close-tx");
    if (!b) return;
    // Idempotent: same rule as the chat button.
    if (String(b.dataset.closed) === String(closed)) return;
    b.dataset.closed = String(closed);
    b.classList.toggle("active", closed);
    // Label announces the ACTION the button performs on click.
    b.textContent = closed ? "↺ Transcript" : "✕ Transcript";
  }

  function showReenableBar() {
    ensureFloatUI();
  }

  // ── Apply the policy to the current watch page ──────────────────────────
  // Idempotent: track the state we last set so repeated observer fires (YouTube's
  // DOM churns constantly) don't re-click / re-collapse on every mutation.
  let applied = {}; // { chat: 'locked'|'unlocked'|'none', tx: 'open'|'closed'|'pending' }
  let navTick = 0;
  // Bounded retry for the transcript: on a fresh reload YouTube mounts the
  // description/transcript button AFTER our first pass, so "no button yet" must
  // not settle as "open". Poll a few times; only then give up.
  let txRetryTimer = 0;
  let txRetries = 0;
  function resetTxRetries() {
    txRetries = 0;
    weClosed = false; // navigation: the panel belongs to the new page again
    verifyActive = false; // drop any in-flight verify chain on navigation
    if (txRetryTimer) { clearTimeout(txRetryTimer); txRetryTimer = 0; }
  }
  const TX_RETRY_CAP = 40; // slow-poll for ~2 min on stalled pages
  function scheduleTxRetry() {
    if (txRetryTimer || txRetries >= TX_RETRY_CAP) return;
    txRetries++;
    // Fast start (~1.2s), then settle into a 3s slow-poll so a button that
    // mounts late on a stalled page (Zen with a heavy session) still gets
    // caught long after the observer would have noticed it.
    const delay = txRetries < 6 ? 800 + 400 * txRetries : 3000;
    txRetryTimer = setTimeout(() => {
      txRetryTimer = 0;
      if (isWatchPage() && !document.hidden) applyPolicy();
    }, delay);
  }
  function navType() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      return (nav && nav[0] && nav[0].type) || "";
    } catch (_) { return ""; }
  }
  function isReloadPage() {
    return navType() === "reload";
  }
  // Loop insurance, not suppression: YouTube's error-recovery reload (poking
  // its engagement panel mid-boot) would re-open → reload → re-open forever.
  // The readiness gate already prevents the mid-boot poke; this rate limit is
  // a backstop for whatever remains. Timestamps live in sessionStorage so the
  // count survives reloads (a genuine loop crosses pages; a single user hard
  // refresh is one open — far under the limit).
  const AUTOOPEN_WINDOW = 30000; // 30s
  const AUTOOPEN_MAX = 3;
  function autoOpenTimes() {
    try { return JSON.parse(sessionStorage.getItem("tfg.autoOpens") || "[]"); } catch (_) { return []; }
  }
  function autoOpenAllowed() {
    const now = Date.now();
    const times = autoOpenTimes().filter((t) => now - t < AUTOOPEN_WINDOW);
    if (times.length >= AUTOOPEN_MAX) {
      diag("open: suppressed (auto-open rate limit)");
      return false;
    }
    try { sessionStorage.setItem("tfg.autoOpens", JSON.stringify(times)); } catch (_) {}
    return true;
  }
  function noteAutoOpen() {
    try {
      const now = Date.now();
      const times = autoOpenTimes().filter((t) => now - t < AUTOOPEN_WINDOW);
      times.push(now);
      sessionStorage.setItem("tfg.autoOpens", JSON.stringify(times.slice(-6)));
    } catch (_) {}
  }
  // Bounded patience: Zen pages can stay at `interactive` indefinitely (heavy
  // sessions, blocked subresources) and never fire `complete`. If the page
  // hasn't completed after PATIENCE_RETRIES (~7s) of polling, act anyway —
  // the player crash was proven to be Zen's hard-refresh bug, not our clicks.
  const PATIENCE_RETRIES = 4;

  // One open attempt can be swallowed by YouTube's panel logic if it lands a
  // moment too early (Zen: first click no-ops, second works). After an open
  // click, verify the panel actually opened and re-click (bounded) until it
  // does — or until the user closes it, navigation happens, or attempts run
  // out. The spacing (OPEN_VERIFY_DELAY) keeps total pokes low; the panel
  // check is computed-style truth, so a visible panel is never re-clicked.
  const OPEN_VERIFY_ATTEMPTS = 3;
  const OPEN_VERIFY_DELAY = 3000;
  let verifyActive = false;
  function scheduleOpenVerify() {
    if (verifyActive) return;
    verifyActive = true;
    let left = OPEN_VERIFY_ATTEMPTS;
    const tick = () => {
      if (SESSION.transcriptClosed || isTranscriptOpen()) { verifyActive = false; return; }
      left--;
      if (left < 0) { verifyActive = false; return; }
      diag("open: retry (swallowed click)");
      openTranscript();
      setTimeout(tick, OPEN_VERIFY_DELAY);
    };
    setTimeout(tick, OPEN_VERIFY_DELAY);
  }

  function applyPolicy(opts) {
    if (!isWatchPage()) return;
    opts = opts || {};
    ensureFloatUI();
    deepTx = null; // fresh deep-lookup memo for this pass
    const started = ++navTick;

    // Live chat. An explicit user toggle (SESSION.liveChatUnlocked set) wins
    // over the popup default; otherwise follow DEFAULTS.closeLiveChat.
    const userToggledChat = SESSION.liveChatUnlocked !== undefined;
    let chatState = "none";
    if (hasLiveChat()) {
      chatState = userToggledChat
        ? (SESSION.liveChatUnlocked ? "unlocked" : "locked")
        : (DEFAULTS.closeLiveChat ? "locked" : "unlocked");
      if (chatState === "locked" && applied.chat !== "locked") { collapseLiveChat(); applied.chat = "locked"; }
      if (chatState === "unlocked" && applied.chat !== "unlocked") { restoreLiveChat(); applied.chat = "unlocked"; }
      setChatBtnState(chatState === "unlocked");
    } else {
      if (applied.chat !== "none") { applied.chat = "none"; }
    }

    // Transcript: only act when we detect a hard navigation (URL change), not on
    // the per-node churn — otherwise we'd fight the user instantly closing it.
    // An explicit user toggle (SESSION.transcriptClosed set) wins over the
    // popup default; otherwise follow DEFAULTS.openTranscript.
    const userToggledTx = SESSION.transcriptClosed !== undefined;
    const txBtn = transcriptBtn();
    const txPanel = q(SELECTORS.transcriptPanel);
    const txOpen = isTranscriptOpen();
    const wantOpenTx =
      transcriptEnabled() && !SESSION.transcriptClosed &&
      (DEFAULTS.openTranscript || userToggledTx);
    const pageComplete = document.readyState === "complete";
    // The player is NOT part of the gate: Zen's hard refresh can leave the
    // player in "playback isn't supported" (a Zen codec bug — happens with the
    // extension fully removed too), yet the transcript panel opens fine on
    // such pages. Only page readiness matters — never poke mid-boot.
    const playerMounted = !!q("#movie_player video"); // informational only
    const playerError = !!q("#movie_player.ytp-error, #movie_player .ytp-error"); // informational only
    const mayAct = pageComplete || txRetries >= PATIENCE_RETRIES || opts.userOpen;
    const stLine =
      "tx open=" + (txOpen ? 1 : 0) +
      " hid=" + (txPanel ? (txPanel.hasAttribute("hidden") ? 1 : 0) : ".") +
      " want=" + (wantOpenTx ? 1 : 0) +
      " ready=" + document.readyState.slice(0, 4) +
      " player=" + (playerMounted ? 1 : 0) +
      " act=" + (mayAct ? 1 : 0) +
      " r=" + txRetries +
      " sess=" + (SESSION.transcriptClosed === undefined ? "u" : SESSION.transcriptClosed ? "1" : "0") +
      " btn=" + (txBtn ? (txBtn.getAttribute("aria-label") || txBtn.textContent || "?").slice(0, 9) : "null");
    diag(stLine, JSON.stringify({
      btn: txBtn ? (txBtn.getAttribute("aria-label") || txBtn.textContent || "btn").slice(0, 30) : null,
      panel: !!txPanel, panelHidden: txPanel ? txPanel.hasAttribute("hidden") : null,
      open: txOpen, enabled: transcriptEnabled(),
      wantOpen: wantOpenTx, sessClosed: SESSION.transcriptClosed,
      defOpen: DEFAULTS.openTranscript, userToggled: userToggledTx,
      retries: txRetries, ready: document.readyState,
      complete: pageComplete, reload: isReloadPage(),
      player: playerMounted, perr: playerError,
      app: !!q("ytd-app"), scripts: (document.scripts || []).length,
      txish: Array.from(document.querySelectorAll("[aria-label*='ranscript']"))
        .slice(0, 4)
        .map((b) => (b.getAttribute("aria-label") || b.tagName.toLowerCase()).slice(0, 26)),
      sr: (() => { const d = q("ytd-video-description-transcript-section-renderer"); return d ? !!d.shadowRoot : null; })()
    }));
    // Honest label: with a user override, show the override's action;
    // otherwise derive from what's actually on screen.
    setTxBtnState(userToggledTx ? SESSION.transcriptClosed === true : !txOpen);
    if (wantOpenTx) {
      // No `applied.tx` gate here: openTranscript() is idempotent (it never
      // clicks the toggle when the panel is already open), so the observer must
      // be free to recover a transcript that mounts LATE — even long after the
      // bounded retry window. A gate would settle and miss the recovery.
      if (mayAct && (opts.userOpen || autoOpenAllowed())) {
        if (!isTranscriptOpen()) {
          requestAnimationFrame(() => {
            if (!SESSION.transcriptClosed && !isTranscriptOpen()) {
              diag("open: clicking show-transcript button");
              openTranscript(!!opts.userOpen);
              if (!opts.userOpen) noteAutoOpen();
              scheduleOpenVerify();
            }
          });
        }
        applied.tx = "open";
      } else if (!mayAct) {
        // Page not ready (booting, player not mounted yet, or player error):
        // never poke the engagement panel before the player is up — in
        // Zen/Firefox that can break playback. Keep polling; the bounded
        // retries give up.
        scheduleTxRetry();
        applied.tx = "pending";
      } else {
        // Auto-open rate-limited (loop backstop): settle WITHOUT opening. The
        // user can still open manually — explicit opens bypass the limit.
        applied.tx = "open";
      }
    } else if (SESSION.transcriptClosed && applied.tx !== "closed") {
      diag("close: transcript closed by user override");
      closeTranscript();
      applied.tx = "closed";
    } else if (!SESSION.transcriptClosed && applied.tx !== "open") {
      if (transcriptEnabled()) {
        // Button exists but we're not opening (default off, no explicit toggle):
        // settled — nothing more to do.
        applied.tx = "open";
      } else {
        // No transcript affordance YET. On a fresh reload YouTube mounts the
        // description (and its "Show transcript" button) AFTER our first pass.
        // Retry a few times; settle only when the affordance shows up or the
        // bounded retries are exhausted (video without captions).
        scheduleTxRetry();
        if (txRetries >= TX_RETRY_CAP) applied.tx = "open";
        else applied.tx = "pending";
      }
    }
  }

  // ── SPA navigation detection + mutation resilience ──────────────────────
  // YouTube is a single-page app; watch→watch keeps the same document. Watch for
  // URL changes and for the arrival/removal of the chat/transcript nodes.
  let lastUrl = location.href;
  let navApplied = false;
  function maybeNavigate() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      navApplied = false;
      applied = {};
      resetTxRetries();
      applyPolicy();
    }
  }

  // Only fire applyPolicy when a watched element actually appears/disappears or
  // when we navigate — NOT on every arbitrary DOM mutation (YouTube churns).
  // Cheap: direct matches only, NO subtree scans (a subtree scan on real YouTube
  // nodes — which can be thousands of elements — pegs the main thread in
  // Firefox's wrapped DOM and starves the page's own JS).
  function relevantMutation(records) {
    for (const rec of records) {
      const nodes = [...(rec.addedNodes || []), ...(rec.removedNodes || [])].filter(n => n && n.nodeType === 1);
      for (const node of nodes) {
        if (node.matches && node.matches(
          "ytd-live-chat-frame, yt-live-chat-renderer, #chat-container, " +
          "ytd-engagement-panel-section-list-renderer, " +
          "ytd-video-description-transcript-section-renderer, [aria-label*='ranscript']")) {
          return true;
        }
      }
    }
    return false;
  }

  // Debounce applyPolicy: on a busy YouTube page the observer can fire dozens of
  // times per second; collapsing them to one pass (trailing edge) keeps us at
  // ~2 passes/sec worst case instead of starving the page.
  let applyTimer = 0;
  function scheduleApply() {
    if (applyTimer) return;
    applyTimer = setTimeout(() => { applyTimer = 0; applyPolicy(); }, 350);
  }

  let observer;
  if (typeof MutationObserver === "function") {
    observer = new MutationObserver((records) => {
      maybeNavigate();
      if (navApplied === false) {
        // First pass: always apply once the widgets have had a chance to mount.
        navApplied = true;
        setTimeout(applyPolicy, 400);
      } else if (relevantMutation(records) && !document.hidden) {
        scheduleApply();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener("yt-navigate-finish", () => { applied = {}; resetTxRetries(); applyPolicy(); });

  // Initial application (with a short wait for the widgets to mount).
  if (document.readyState === "complete") {
    applyPolicy();
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(applyPolicy, 800));
  }
})();
