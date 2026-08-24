// Popup for Transcript-First & Live Chat Guard
const DEFAULTS = { openTranscript: true, closeLiveChat: true };

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
}

document.addEventListener("DOMContentLoaded", init);
