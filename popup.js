// Popup for Transcript-First & Live Chat Guard
const DEFAULTS = { openTranscript: true, closeLiveChat: true };
const ORIGIN = "*://*.youtube.com/*";

// Firefox exposes the promise-based `browser.*` namespace; Chromium MV3 also
// returns promises from `chrome.permissions.*` when no callback is passed.
// Using promises in both avoids the "callback + promise" double-call hazard.
const permAPI = (typeof browser !== "undefined" && browser.permissions)
  ? browser.permissions
  : chrome.permissions;

async function hasYoutubeAccess() {
  try {
    return await permAPI.contains({ origins: [ORIGIN] });
  } catch (e) {
    // If we cannot even query, don't nag — assume granted.
    return true;
  }
}

function showGrant(on) {
  const box = document.getElementById("grant");
  if (box) box.hidden = !on;
}

function showErr(msg) {
  const el = document.getElementById("grantErr");
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

async function wireGrant() {
  const btn = document.getElementById("grantBtn");
  if (!btn) return;

  if (await hasYoutubeAccess()) {
    showGrant(false);
    return;
  }
  showGrant(true);

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    showErr("");
    let granted = false;
    try {
      // MUST be called synchronously from the click handler for the user
      // gesture to count. Firefox shows its own native prompt.
      granted = await permAPI.request({ origins: [ORIGIN] });
    } catch (e) {
      granted = false;
      showErr("The browser blocked the request (" + (e && e.message ? e.message : e) + ").");
    }
    btn.disabled = false;

    if (granted) {
      showGrant(false);
      const hint = document.createElement("div");
      hint.className = "hint ok";
      hint.textContent = "Enabled ✓ — reload the YouTube tab to apply.";
      const grant = document.getElementById("grant");
      if (grant && grant.parentNode) grant.parentNode.insertBefore(hint, grant.nextSibling);
      return;
    }
    // Refused or blocked: name the manual path, but keep it small.
    showErr("Not granted. You can still allow it in about:addons → Transcript-First & Live Chat Guard → Permissions.");
  });
}

function init() {
  const openTx = document.getElementById("openTranscript");
  const closeChat = document.getElementById("closeLiveChat");

  chrome.storage.sync.get(DEFAULTS, (items) => {
    const it = Object.assign({}, DEFAULTS, items || {});
    openTx.checked = Boolean(it.openTranscript);
    closeChat.checked = Boolean(it.closeLiveChat);
  });

  function save(key) {
    return (e) => {
      const patch = { [key]: e.target.checked };
      chrome.storage.sync.set(patch, () => {
        // The content script listens to storage.onChanged and updates live.
      });
    };
  }
  openTx.addEventListener("change", save("openTranscript"));
  closeChat.addEventListener("change", save("closeLiveChat"));

  wireGrant();
}

document.addEventListener("DOMContentLoaded", init);
