/**
 * WordTap Options Page Script
 */
(() => {
  const DEFAULTS = {
    targetLang: "ar",
    selectionMode: "immediate"
  };

  const form = document.getElementById("optionsForm");
  const langSelect = document.getElementById("lang");
  const resetBtn = document.getElementById("resetBtn");
  const statusMsg = document.getElementById("statusMsg");

  function restoreOptions() {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      langSelect.value = items.targetLang || "ar";
      const mode = items.selectionMode || "immediate";
      const radio = document.querySelector(`input[name="selectionMode"][value="${mode}"]`);
      if (radio) radio.checked = true;
    });
  }

  function saveOptions(e) {
    if (e) e.preventDefault();
    const selectedMode = document.querySelector('input[name="selectionMode"]:checked')?.value || "immediate";
    const selectedLang = langSelect.value;

    chrome.storage.sync.set(
      {
        targetLang: selectedLang,
        selectionMode: selectedMode
      },
      () => {
        statusMsg.style.display = "inline";
        setTimeout(() => {
          statusMsg.style.display = "none";
        }, 2000);
      }
    );
  }

  function resetOptions() {
    langSelect.value = DEFAULTS.targetLang;
    const defaultRadio = document.querySelector(`input[name="selectionMode"][value="${DEFAULTS.selectionMode}"]`);
    if (defaultRadio) defaultRadio.checked = true;
    saveOptions();
  }

  document.addEventListener("DOMContentLoaded", restoreOptions);
  form.addEventListener("submit", saveOptions);
  resetBtn.addEventListener("click", resetOptions);
})();
