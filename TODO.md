# ToDo — Transcript-First & Live Chat Guard

## OPEN — duplicate transcript recurred in the field (2026-09-11)

**Status:** OPEN — reported by Mike on YouTube while running **v1.1.22**.

**Version check (done 2026-09-11):** v1.1.22 **is** the current build —
`manifest.json` and the in-script `VERSION` both read `1.1.22`; repo is clean;
`youtube-transcript-guard.zip` ≡ `transcript-first-guard.xpi`, MD5
`6d68236db8fe41cb1222d5c0156fb187`, built 2026-08-28. **So this is not a stale
install.**

**Why it is open again:** v1.1.22 was the two-surface fix for exactly this
symptom (inline `ytd-video-description-transcript-section-renderer` surface vs
the old slide-out engagement panel). It passed the headless harness but **never
had Mike's Zen acceptance pass**, so the defect surviving in the field means
either:
- (a) the fix is incomplete on a *third* surface / DOM ordering the harness
  does not model, or
- (b) a race/ordering path bypasses it — the 2026-08-25 hypotheses #1 (racing
  `applyPolicy` passes double-clicking the toggle), #2 (verify/retry chains
  re-clicking a desynced label) and #4 (two extension instances both
  auto-opening) were never individually excluded; only #3 (two-surface blind
  spot) was confirmed and fixed.

**Do NOT re-close on harness evidence alone.**

### Next steps (cheap evidence first)

1. **Capture before coding.** Ask Mike for:
   - the `#tf-status` compact line: `tx open= hid= want= ready= act= r= sess= btn=`
   - the `[TF-guard]` console JSON: `panel, btn, txish, sr, app, scripts`
   - the video URL and browser (Zen vs Chromium)
   - whether a second install exists (about:addons / about:debugging) → tests
     hypothesis #4
2. **Read the evidence:**
   - high `txish` with `open=0` → state check still surface-blind (new selector
     or structure) → hypothesis (a)
   - `open=1` early with `r` climbing → racing-pass double-click → hypothesis #1
   - two installs listed → hypothesis #4
3. **Reproduce in the harness FIRST** — extend `test/harness.html` with whatever
   the evidence implicates (a third mock surface, or a same-frame double-apply
   race) and prove the failure before editing `content.js`. The harness missed
   this recurrence once already.
4. Only then change `content.js`, rebuild both packages via `build_release.py`
   (byte-identical zip ≡ xpi, forward-slash arcnames), record the new MD5 in the
   MD5 chain, and re-sync the fleet download pages (`render_downloads.py`).

### Reference

Full project state, the prior root-cause write-up, and the capture-field schema
live in the `browser-extension-debugging` skill →
`references/youtube-transcript-guard.md` ("OPEN AGAIN" section).
