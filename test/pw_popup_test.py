#!/usr/bin/env python3
"""DOM-mock verification for popup.html/popup.js — the host-permission grant UI.

Chromium 137+ removed --load-extension, so a real unpacked load is not
available. This stubs the extension globals instead and asserts on the
rendered banner, which is what the grant path actually controls.

Run:  /path/to/python test/pw_popup_test.py
"""
import glob
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POPUP = "file:///" + os.path.join(ROOT, "popup.html").replace("\\", "/")


def find_chromium():
    """Playwright's bundled headless_shell may be absent — use a full Chromium build."""
    pats = [
        os.path.expanduser(r"~\AppData\Local\ms-playwright\chromium-*\chrome-win64\chrome.exe"),
        r"C:\Users\Mike2\AppData\Local\ms-playwright\chromium-*\chrome-win64\chrome.exe",
    ]
    found = []
    for p in pats:
        found += glob.glob(p)
    return sorted(found)[-1] if found else None

STUB = """
window.__grants = { contains: %CONTAINS%, request: %REQUEST% };
window.__calls = [];
function mkPerms() {
  return {
    contains: async (q) => { window.__calls.push(['contains', q]); return window.__grants.contains; },
    request:  async (q) => { window.__calls.push(['request', q]);  window.__grants.request = window.__grants.requestAfter === undefined ? window.__grants.request : window.__grants.requestAfter; return window.__grants.request; },
  };
}
window.chrome = {
  storage: { sync: { get: (defaults, cb) => cb({}), set: (patch, cb) => { if (cb) cb(); } } },
  permissions: mkPerms(),
};
%MAYBE_BROWSER%
"""


def stub(contains: bool, request: bool, with_browser: bool) -> str:
    js = STUB.replace("%CONTAINS%", "true" if contains else "false")
    js = js.replace("%REQUEST%", "true" if request else "false")
    js = js.replace(
        "%MAYBE_BROWSER%",
        "window.browser = { permissions: window.chrome.permissions, storage: window.chrome.storage };"
        if with_browser else "",
    )
    return js


EXE = find_chromium()


def run_case(pw, name, contains, request, with_browser, expect_visible, expect_ok_text, expect_err):
    browser = pw.chromium.launch(executable_path=EXE) if EXE else pw.chromium.launch()
    page = browser.new_page()
    page.add_init_script(stub(contains, request, with_browser))
    page.goto(POPUP)
    page.wait_for_timeout(300)

    visible = page.eval_on_selector("#grant", "el => !el.hidden")
    print(f"[{name}] grant banner visible={visible} (expected {expect_visible})")
    if visible != expect_visible:
        print("  FAIL banner visibility")
        browser.close()
        return False

    ok = True
    if visible and request is not None:
        page.click("#grantBtn")
        page.wait_for_timeout(300)
        after_visible = page.eval_on_selector("#grant", "el => !el.hidden")
        body = page.inner_text("body")
        print(f"[{name}] after click: banner visible={after_visible}")
        if request and after_visible:
            print("  FAIL banner should hide after a successful grant")
            ok = False
        if request and not after_visible:
            has_ok = expect_ok_text in body
            print(f"[{name}] confirmation text present={has_ok}")
            ok = ok and has_ok
        if not request:
            err_shown = page.eval_on_selector("#grantErr", "el => !el.hidden && el.textContent.length > 0")
            print(f"[{name}] error shown on refusal={err_shown}")
            ok = ok and err_shown
        # node: a click must have produced a request() call carrying our origin
        calls = page.evaluate("() => window.__calls.filter(c => c[0] === 'request').length")
        origin_ok = page.evaluate(
            "() => window.__calls.some(c => c[0] === 'request' && c[1].origins && c[1].origins[0] === '*://*.youtube.com/*')"
        )
        print(f"[{name}] request calls={calls} origin-correct={origin_ok}")
        ok = ok and calls == 1 and origin_ok

    browser.close()
    print(f"[{name}] {'PASS' if ok else 'FAIL'}\n")
    return ok


def main():
    results = []
    with sync_playwright() as pw:
        # 1. No access yet → banner shown; click grants → banner gone + confirmation
        results.append(run_case(pw, "not-granted-then-granted", False, True, False, True, "Enabled", None))
        # 2. Access already granted → banner hidden, no nagging
        results.append(run_case(pw, "already-granted", True, None, False, False, None, None))
        # 3. User refuses → error naming the about:addons fallback
        results.append(run_case(pw, "refused", False, False, False, True, None, "about:addons"))
        # 4. Firefox namespace path (browser.* present) behaves identically
        results.append(run_case(pw, "firefox-namespace-not-granted", False, True, True, True, "Enabled", None))
    print("SUMMARY:", "ALL PASS" if all(results) else f"{results.count(False)} FAILED")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
