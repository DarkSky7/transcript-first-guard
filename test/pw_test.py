"""Playwright smoke-test of the extension logic via the harness at /watch.html.
Loads the DOM-mock harness, which pulls in content.js directly, then asserts the
default policy (open transcript / collapse live chat) and the user overrides."""
from playwright.sync_api import sync_playwright
import json

CHROME = r"c:/Users/Mike2/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe"
URL = "http://127.0.0.1:8931/watch.html"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, headless=True)
    page = browser.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(f"console[{m.type}]: {m.text}") if m.type == "error" else None)
    page.goto(URL, wait_until="commit", timeout=30000)
    page.wait_for_timeout(1000)
    try:
        page.wait_for_function("typeof window.__probe === 'function'", timeout=10000)
    except Exception as e:
        print("PROBE_NOT_READY:", e)
        print("URL:", page.url)
        print("BODY:", page.content()[:800])
        raise
    page.wait_for_timeout(1500)  # let content.js applyPolicy + transcript rAF settle

    def probe():
        return json.loads(page.evaluate("JSON.stringify(window.__probe())"))

    before = probe()
    page.evaluate("window.__clickReenable()"); page.wait_for_timeout(300)
    after_reenable = probe()
    page.evaluate("window.__clickCloseTx()"); page.wait_for_timeout(300)
    after_close = probe()
    # Toggle-back: the transcript button must RE-OPEN a closed transcript
    # (regression: previously it was close-only and could never re-open).
    page.evaluate("window.__clickCloseTx()"); page.wait_for_timeout(600)
    after_reopen_tx = probe()
    # Toggle-back: the chat button must re-LOCK an unlocked chat.
    page.evaluate("window.__clickReenable()"); page.wait_for_timeout(300)
    after_relock_chat = probe()

    # ── TWO-SURFACE REPRO (2026-08-28 fix): with ONLY the inline transcript
    #    open (the modern YouTube layout), the float button must (a) recognize
    #    it as open — OLD code only measured the engagement panel and saw
    #    "closed", opening the panel too (the duplicate bug) — and (b) close
    #    it. Sequence: close everything first, then open the inline ONLY.
    page.evaluate("window.__clickCloseTx()"); page.wait_for_timeout(300)  # ensure all closed
    page.evaluate("window.__openInlineOnly()"); page.wait_for_timeout(300)
    inline_only = probe()   # expect: inlineHidden=false, panel hidden, btn=Hide
    # Float button must now close the inline copy in one click.
    page.evaluate("window.__clickCloseTx()"); page.wait_for_timeout(600)
    after_close_inline = probe()  # expect: inlineHidden=true, panel hidden

    # Simulate a "subsequently opened watch page" in the same tab: sessionStorage
    # persists across SPA navigations, so the user's overrides must carry over.
    page.evaluate("history.pushState({}, '', '/watch.html?sec=2')")
    page.wait_for_timeout(500)
    # Force re-apply (SPA navigation) by dispatching the YouTube navigate event.
    page.evaluate("window.dispatchEvent(new Event('yt-navigate-finish'))")
    page.wait_for_timeout(500)
    after_nav = probe()

    print("BEFORE:", json.dumps(before))
    print("AFTER_REENABLE:", json.dumps(after_reenable))
    print("AFTER_CLOSE_TX:", json.dumps(after_close))
    print("AFTER_REOPEN_TX:", json.dumps(after_reopen_tx))
    print("AFTER_RELOCK_CHAT:", json.dumps(after_relock_chat))
    print("INLINE_ONLY:", json.dumps(inline_only))
    print("AFTER_CLOSE_INLINE:", json.dumps(after_close_inline))
    print("AFTER_SUBSEQUENT_NAV:", json.dumps(after_nav))
    print("PAGE_ERRORS:", errs if errs else "none")
    browser.close()
