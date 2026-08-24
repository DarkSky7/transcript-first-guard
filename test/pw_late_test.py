"""Late-mount regression: transcript button appears AFTER the first applyPolicy
pass (as on a real reload). The extension must still open the transcript once
the affordance mounts — it must NOT settle as "open" prematurely."""
from playwright.sync_api import sync_playwright
import json

CHROME = r"c:/Users/Mike2/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe"
URL = "http://127.0.0.1:8931/watch_late.html"

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
        raise
    # Before the late mount (t=1.0s): button not present yet.
    early = json.loads(page.evaluate("JSON.stringify(window.__probe())"))
    # Wait past the late mount (t=6s) + debounce+observer reaction (350ms+).
    page.wait_for_function("window.__lateMounted === true", timeout=15000)
    page.wait_for_timeout(3000)
    late = json.loads(page.evaluate("JSON.stringify(window.__probe())"))

    print("EARLY (before late mount):", json.dumps(early))
    print("LATE  (after late mount + retries):", json.dumps(late))
    print("PAGE_ERRORS:", errs if errs else "none")

    ok = (
        early["lateMounted"] is False and early["transcriptHidden"] is None and
        late["lateMounted"] is True and late["transcriptHidden"] is False and
        late["transcriptDisplay"] != "none" and late["chatDisplay"] == "none"
    )
    print("PASS" if ok else "FAIL")
    browser.close()
    raise SystemExit(0 if ok else 1)
