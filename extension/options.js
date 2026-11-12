/**
 * WordTap Options Page Script
 */
(() => {
  const DEFAULTS = {
    targetLang: "ar",
    selectionMode: "icon",
    protectAiChats: true,
    translateSaveMode: "manual",
  };

  const form = document.getElementById("optionsForm");
  const langSelect = document.getElementById("lang");
  const protectAiChatsCheck = document.getElementById("protectAiChats");
  const resetBtn = document.getElementById("resetBtn");
  const statusMsg = document.getElementById("statusMsg");

  function restoreOptions() {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      langSelect.value = items.targetLang || "ar";
      const mode = items.selectionMode || "icon";
      const radio = document.querySelector(`input[name="selectionMode"][value="${mode}"]`);
      if (radio) radio.checked = true;

      const saveMode = items.translateSaveMode || (items.saveWords ? "auto" : "manual");
      const saveRadio = document.querySelector(`input[name="translateSaveMode"][value="${saveMode}"]`);
      if (saveRadio) saveRadio.checked = true;

      if (protectAiChatsCheck) {
        protectAiChatsCheck.checked = items.protectAiChats !== false;
      }
    });
  }

  function saveOptions(e) {
    if (e) e.preventDefault();
    const selectedMode = document.querySelector('input[name="selectionMode"]:checked')?.value || "icon";
    const selectedSaveMode = document.querySelector('input[name="translateSaveMode"]:checked')?.value || "manual";
    const selectedLang = langSelect.value;
    const protectAi = protectAiChatsCheck ? protectAiChatsCheck.checked : true;

    chrome.storage.sync.set(
      {
        targetLang: selectedLang,
        selectionMode: selectedMode,
        translateSaveMode: selectedSaveMode,
        saveWords: selectedSaveMode !== "manual",
        protectAiChats: protectAi,
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
    if (protectAiChatsCheck) protectAiChatsCheck.checked = DEFAULTS.protectAiChats;
    saveOptions();
  }

  document.addEventListener("DOMContentLoaded", restoreOptions);
  form.addEventListener("submit", saveOptions);
  resetBtn.addEventListener("click", resetOptions);
})();
