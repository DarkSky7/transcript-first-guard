# Building a YouTube extension for Firefox: 10 traps the docs don't tell you

*A field report from shipping "Transcript-First & Live Chat Guard" — an MV3 extension that auto-opens the YouTube transcript and collapses live chat, tested against Chromium, Firefox, and Zen.*

You'd think a content script that clicks one button is simple. It took 17 builds and a DOM-mock harness to make it behave identically across browsers. Here's what the MDN docs won't warn you about.

## 1. Never fight YouTube's DOM — click YouTube's buttons
Forcing `hidden`/`display` on an engagement panel makes YouTube's own state machine angry in ways that look like *your* bug: error-recovery reloads in Chromium, and in Zen (Firefox-based) a **page that never finishes loading**. The only reliable moves are clicking YouTube's own toggle buttons and reading its own labels. Direct attribute manipulation is reserved for artifacts you created yourself — tracked with a flag, stripped only by your own open path.

## 2. `document.querySelector` lies in Firefox
Some YouTube `ytd-*` widgets render inside **open shadow roots**, invisible to `querySelector` — the same page where Chromium sees the button in light DOM. Your selector layer needs: light DOM by aria-label → *any* element by aria-label (affordances aren't always `<button>`s) → buttons by text content → a deep walk into `el.shadowRoot`.

## 3. The deep walk will stall Firefox if you're careless
Traversing every element to read `.shadowRoot` on each is hundreds of ms per pass on a real YouTube page — in Firefox's Xray-wrapped DOM it's enough to **starve the page's own boot scripts**, so the load event never fires. Walk only custom elements (`ytd-*`/`tp-yt-*`; CSS has no wildcard type selector, so use XPath `//*[starts-with(local-name(),'ytd-')]`) and throttle to once per 2s.

## 4. sessionStorage survives Firefox session-restore — Chromium's doesn't
A "user closed the transcript" flag written to sessionStorage rides along with **restored tabs across browser restarts** in Firefox/Zen. Your defaults silently stop applying and nobody knows why. Timestamp your overrides, expire them, and treat untimestamped legacy values as expired.

## 5. `readyState` may stay `interactive` forever
On a heavy Firefox session the page can hang at `interactive` and never fire `complete`. If your auto-action waits for `complete`, it never fires. Use bounded patience: poll, then act after ~7s — but only after you've confirmed your action is safe mid-boot (see #1).

## 6. YouTube swallows toggle clicks that land a moment early
First click: nothing. Second click: works. This one ate a whole day. After every click, verify the panel state ~0.8s later and re-click (bounded, spaced 3s apart, stopping the moment the panel is visible).

## 7. Trust computed style, not the label
"Show transcript"/"Hide transcript" aria-labels desync from reality in Firefox (label says Show, panel is open; or panel present but hidden with no `hidden` attribute). "Open" = `getComputedStyle(panel).display !== 'none'`.

## 8. `console.debug` is invisible in Firefox — and so is your bug
Firefox hides debug-level logs by default. Use `console.log` — and mirror your diagnostics into an on-page status element so the user can read state without devtools at all. It turned a week of "paste me the console" loops into "read me the line at the bottom-right."

## 9. Verify which build is actually loaded
`about:debugging` shows the manifest version. If the manifest version and the in-script `VERSION` const diverge, you cannot tell whether the user is running the build you think they are. Bump both, every time.

## 10. Zen (Firefox fork) has its own hard-refresh video bug
Ctrl+Shift+R on a YouTube watch page breaks playback ("Playback isn't supported on this device") — **with all extensions removed**. F5 recovers. It's a browser codec/EME renegotiation bug, not yours. Report draft included in this repo (`zen-bug-report.md`) — and it's the first thing to check when a user reports "your extension broke YouTube."

---

*The extension: MV3, `storage` permission only, `browser_specific_settings.gecko.id` for AMO. Tested with a DOM-mock harness + Playwright Chromium (no Playwright Firefox needed). Happy to share the harness pattern — it caught more regressions than any real-browser session did.*
