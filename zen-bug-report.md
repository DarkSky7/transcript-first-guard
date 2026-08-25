# Bug report: YouTube "Playback isn't supported on this device" after hard refresh

**Repo:** zen-browser/desktop · **Component:** media/player (suspected codec/EME)
**Platform:** Windows 11

## Environment
- Zen Browser 1.21.15b (buildID 20260818) — Firefox 154.0-based
- Windows 11
- Reproduced with **all extensions removed** (not extension-related)

## Steps to reproduce
1. Open a YouTube watch page (e.g. `https://www.youtube.com/watch?v=H6n3iNh4XLI`). Video plays normally.
2. Press **Ctrl+Shift+R** (hard refresh / bypass cache).
3. The player shows **"Playback isn't supported on this device"** and the video will not play.
4. Press **F5 / Ctrl+R** (normal reload) → the video plays again.
5. Occasionally the broken state survives a normal reload and needs another refresh cycle; a second hard refresh sometimes also recovers it.

## Expected
A hard refresh should behave like a normal reload for playback purposes — the video keeps playing.

## Actual
The player enters an error state after a no-cache reload and refuses to play until a subsequent reload (normal or repeated hard refresh).

## Notes
- The page itself loads fine; only the video player is affected.
- Suspected area: player codec / EME (Widevine) re-initialization after a cache-bypass reload. The error state is not recovered by the player's own retry logic.
- May be related to the broader DRM/streaming issues class (see discussion #1831).
- DevTools on the affected page warns: *"connected browser is more recent (154.0, buildID 20260818) than your Zen (1.21.15b)… may cause DevTools to fail"* — probably only relevant to debugging, but noted for completeness.
- **Workaround:** a normal reload (F5/Ctrl+R) restores playback.
- **Firefox check (2026-08-24):** NOT reproducible in Mozilla Firefox on Windows 11 — hard refresh plays normally. Bug is Zen-specific.
- **Filed upstream:** zen-browser/desktop#15090

## Evidence timeline
- Hard refresh → "Playback isn't supported" (extensions removed) → next hard refresh recovers.
- Hard refresh → broken → normal reload recovers.
- Normal reload → always plays.
