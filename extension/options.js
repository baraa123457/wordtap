/**
 * WordTap Options Page Script
 */
(() => {
  const DEFAULTS = {
    targetLang: "ar",
    selectionMode: "immediate",
    translateSaveMode: "manual",
    websiteUrl: "http://localhost:3000",
  };

  const form = document.getElementById("optionsForm");
  const langSelect = document.getElementById("lang");
  const websiteUrlInput = document.getElementById("websiteUrl");
  const resetBtn = document.getElementById("resetBtn");
  const statusMsg = document.getElementById("statusMsg");

  function restoreOptions() {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      langSelect.value = items.targetLang || "ar";
      if (websiteUrlInput) websiteUrlInput.value = items.websiteUrl || DEFAULTS.websiteUrl;
      const mode = items.selectionMode || "immediate";
      const radio = document.querySelector(`input[name="selectionMode"][value="${mode}"]`);
      if (radio) radio.checked = true;

      const saveMode = items.translateSaveMode || (items.saveWords ? "auto" : "manual");
      const saveRadio = document.querySelector(`input[name="translateSaveMode"][value="${saveMode}"]`);
      if (saveRadio) saveRadio.checked = true;
    });
  }

  function saveOptions(e) {
    if (e) e.preventDefault();
    const selectedMode = document.querySelector('input[name="selectionMode"]:checked')?.value || "immediate";
    const selectedSaveMode = document.querySelector('input[name="translateSaveMode"]:checked')?.value || "manual";
    const selectedLang = langSelect.value;
    const rawUrl = websiteUrlInput ? websiteUrlInput.value.trim().replace(/\/+$/, "") : DEFAULTS.websiteUrl;
    const websiteUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : DEFAULTS.websiteUrl;
    if (websiteUrlInput) websiteUrlInput.value = websiteUrl;

    chrome.storage.sync.set(
      {
        targetLang: selectedLang,
        selectionMode: selectedMode,
        translateSaveMode: selectedSaveMode,
        saveWords: selectedSaveMode !== "manual",
        websiteUrl,
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
    if (websiteUrlInput) websiteUrlInput.value = DEFAULTS.websiteUrl;
    const defaultRadio = document.querySelector(`input[name="selectionMode"][value="${DEFAULTS.selectionMode}"]`);
    if (defaultRadio) defaultRadio.checked = true;
    const defaultSave = document.querySelector(`input[name="translateSaveMode"][value="${DEFAULTS.translateSaveMode}"]`);
    if (defaultSave) defaultSave.checked = true;
    saveOptions();
  }

  document.addEventListener("DOMContentLoaded", restoreOptions);
  form.addEventListener("submit", saveOptions);
  resetBtn.addEventListener("click", resetOptions);
})();
