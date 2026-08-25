# Posting kit — "10 traps the docs don't tell you"

Source: `community-post.md`. Repo: https://github.com/DarkSky7/transcript-first-guard

## r/ZenBrowser (primary — Zen-specific bug + Zen-tested)
Angle: the Zen hard-refresh bug (#10) is front and center; extension is a bonus.
1. **"I built a YouTube extension that fixes transcript & live-chat defaults — and found a Zen bug you should know about (Ctrl+Shift+R kills playback)"** — recommended
2. "After 19 builds: what shipping a YouTube extension in Zen taught me (incl. a real Zen hard-refresh bug with repro steps)"
3. "PSA: Ctrl+Shift+R on YouTube in Zen breaks playback — report draft inside, plus my transcript-first extension"
- Hook: "TL;DR your browser isn't broken, Zen has a hard-refresh bug; repro + draft issue in the repo."
- Post the FULL 10 traps + link the repo (has zen-bug-report.md + issue template so readers can file it).

## r/firefoxaddons (dev/AMO audience — the traps are the story)
Angle: traps 1–9 lead; Zen bug is a footnote.
1. **"10 traps MDN won't tell you: building an MV3 YouTube extension for Firefox"** — recommended (matches the file title)
2. "Field report: 19 builds to make a YouTube content script behave — shadow DOM, sessionStorage, and a stalled-boot mystery"
3. "Why your content script can stall Firefox's boot: the shadowRoot deep-walk trap (and 9 more)"
- Hook: "Clicking one button took 19 builds. Here's everything the docs skipped."

## r/firefox (mixed user/dev — lead with the extension)
1. **"Open-source extension: YouTube transcripts open by default, live chat collapsed — and the 10 hard-won lessons building it for Firefox"** — recommended
2. "A tiny MV3 extension that fixes YouTube's defaults (transcript-first) — and what it took to make it work in Firefox"
- Hook: "If you've ever wanted YouTube to open the transcript and shut up the chat, this is for you."

## Mozilla Discourse — Add-ons/Extensions (formal, longer thread)
1. **"Field report: shipping an MV3 YouTube extension for Firefox — 10 traps the docs don't mention"** — recommended
2. "Lessons from 19 builds of a YouTube content script: shadow roots, session-restore state, and boot starvation — feedback welcome"
- Tone: more formal; invite critique of the harness-driven test approach (no Playwright Firefox needed).

## Zen Discord (#extensions / #dev, casual)
1. **"Built a YouTube transcript-first extension for Zen — and found a hard-refresh bug (F5 fixes it, repro steps in repo)"**
2. "Zen + YouTube: Ctrl+Shift+R breaks playback. Draft issue ready to paste + an extension I made while debugging it"
- Keep it 2–3 lines, link repo.

## Sequencing suggestion
1. r/ZenBrowser (full post) — biggest overlap, drives bug-report visibility
2. r/firefoxaddons (full post, retitled) — dev/AMO crowd, fork potential
3. r/firefox (shortened cross-post)
4. Discourse (formal thread, invite feedback)
5. Zen Discord (blurb + link)
Space them a day or two apart to avoid same-URL spam filters.
