# Community post — venue-ready versions

Source: `community-post.md` (the full "10 traps" field report). Repo: https://github.com/DarkSky7/transcript-first-guard
Zen bug: https://github.com/zen-browser/desktop/issues/15090

---

## Mozilla Discourse — Add-ons / Extensions (discourse.mozilla.org)

> Paste-ready. Markdown is supported. Title goes in the topic title field.

**Title:** Field report: shipping an MV3 YouTube extension — 10 traps the docs don't tell you

**Body:**

I just shipped "Transcript-First & Live Chat Guard" — an MV3 extension (Firefox/Zen/Chromium) that auto-opens the YouTube transcript and collapses live chat. It took 17 builds and a DOM-mock harness to make one content script behave identically across browsers. Here are the 10 traps the MDN docs won't warn you about:

1. **Never fight YouTube's DOM — click YouTube's buttons.** Forcing `hidden`/`display` on an engagement panel makes YouTube's state machine angry in ways that look like *your* bug: error-recovery reloads in Chromium, and in Zen a page that never finishes loading. The only reliable moves are clicking YouTube's own toggles and reading its own labels.
2. **`document.querySelector` lies in Firefox.** Some `ytd-*` widgets render inside open shadow roots, invisible to `querySelector`. Your selector layer needs: light DOM by aria-label → any element by aria-label → buttons by text → a deep walk into `el.shadowRoot`.
3. **The deep walk will stall Firefox if you're careless.** Reading `.shadowRoot` on every element is hundreds of ms per pass — enough to starve the page's own boot scripts. Walk only custom elements via XPath (`//*[starts-with(local-name(),'ytd-')]`; CSS has no wildcard type selector) and throttle to once per 2s.
4. **sessionStorage survives Firefox session-restore — Chromium's doesn't.** A "user closed the transcript" flag rides along with restored tabs across restarts in Firefox/Zen, silently disabling your defaults. Timestamp overrides, expire them, treat untimestamped legacy values as expired.
5. **`readyState` may stay `interactive` forever.** On a heavy Firefox session the page can hang at `interactive` and never fire `complete`. Use bounded patience (~7s), not an unconditional `complete` gate.
6. **YouTube swallows toggle clicks that land a moment early.** First click: nothing. Second click: works. Verify panel state ~0.8s after every click and re-click (bounded, spaced, stop when visible).
7. **Trust computed style, not the label.** "Show transcript"/"Hide transcript" aria-labels desync from reality. "Open" = `getComputedStyle(panel).display !== 'none'`.
8. **`console.debug` is invisible in Firefox — and so is your bug.** Firefox hides debug-level logs by default. Use `console.log`, and mirror diagnostics into an on-page status element so users can read state without devtools.
9. **Verify which build is actually loaded.** `about:debugging` shows the manifest version; if it diverges from the in-script `VERSION` const you can't tell what anyone is running. Bump both, every time.
10. **Zen (Firefox fork) has its own hard-refresh video bug.** Ctrl+Shift+R on a YouTube watch page breaks playback ("Playback isn't supported on this device") — with all extensions removed, and **Firefox handles the same hard refresh fine**. F5 recovers. Filed upstream: https://github.com/zen-browser/desktop/issues/15090

The extension is MPL-2.0, `storage` permission only, with a DOM-mock harness + Playwright test suite (no Playwright Firefox needed) — the harness caught more regressions than any real-browser session did. Repo: https://github.com/DarkSky7/transcript-first-guard — happy to share the harness pattern; forks and bug reports welcome.

---

## Zen Discord (discord.gg/zen-browser)

> Three short messages, send in order. Suggest channel: **#general** (or the self-promo/share channel if the server has one).

**Message 1:**
🚀 Just shipped *Transcript-First & Live Chat Guard* — an MV3 extension for Zen/Firefox that auto-opens the YouTube transcript and collapses live chat (one-click toggles both ways, session memory, no data anywhere): https://github.com/DarkSky7/transcript-first-guard

**Message 2:**
⚠️ PSA while I was at it: "Playback isn't supported on this device" after **Ctrl+Shift+R** on YouTube is a **Zen** bug — plain Firefox handles the same hard refresh fine. Filed with full repro: https://github.com/zen-browser/desktop/issues/15090 (F5 always recovers in the meantime)

**Message 3:**
📝 Field report of the 10 traps I hit building it (shadow-DOM selectors, session-restore flags, click verification, the `interactive`-forever hang…): https://github.com/DarkSky7/transcript-first-guard/blob/main/community-post.md — MPL-2.0, forks welcome

---

## Bonus: Reddit titles (post whenever you're ready)

**r/ZenBrowser** (self-post; body = community-post.md):
- "I shipped a YouTube extension for Zen — and found a Zen-only hard-refresh bug worth knowing (filed #15090)"
- "PSA: YouTube 'Playback isn't supported' after Ctrl+Shift+R is a Zen bug, not your fault — Firefox is immune"

**r/firefoxaddons** (self-post; body = community-post.md):
- "Building a YouTube MV3 extension: 10 traps the docs don't tell you"
- "Field report: shadow DOM, session-restore flags, and click-swallowing — 10 traps from shipping an MV3 YouTube extension"
