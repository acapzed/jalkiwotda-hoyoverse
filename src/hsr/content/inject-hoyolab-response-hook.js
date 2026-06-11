(() => {
  const HSR_RECORD_PATHS = new Set([
    "/app/community-game-records-sea/index.html",
    "/app/community-game-records-sea/rpg/index.html",
    "/app/community-game-records-sea/rpg/m.html",
  ]);

  function isHsrRecordPage() {
    return HSR_RECORD_PATHS.has(window.location.pathname) && window.location.hash.startsWith("#/hsr");
  }

  if (!isHsrRecordPage()) {
    return;
  }

  const SHEET_PAGE_URL =
    "https://docs.google.com/spreadsheets/d/1kRQjQrHsgIDqPdnyDCVXG59Ge8AaKm0dyJvj6Vp2AY4/edit?gid=0";

  const INJECTED_FILES = [
    "src/hsr/injected/00-bootstrap.js",
    "src/hsr/injected/01-utils.js",
    "src/hsr/injected/02-sheet.js",
    "src/hsr/injected/03-wiki.js",
    "src/hsr/injected/04-compare.js",
    "src/hsr/injected/05-render.js",
    "src/hsr/injected/06-network.js",
    "src/hsr/injected/07-panel.js",
    "src/hsr/injected/08-main.js",
  ];

  function attachDataset(script) {
    script.dataset.sheetPageUrl = SHEET_PAGE_URL;
    script.dataset.reportImageUrl = chrome.runtime.getURL("src/hsr/assets/report-button.webp");
    script.dataset.statIconUrl = chrome.runtime.getURL("src/hsr/assets/icon-32.png");
    script.dataset.hpIconUrl = chrome.runtime.getURL("src/hsr/assets/hp-icon.webp");
    script.dataset.atkIconUrl = chrome.runtime.getURL("src/hsr/assets/atk-icon.webp");
    script.dataset.defIconUrl = chrome.runtime.getURL("src/hsr/assets/def-icon.webp");
    script.dataset.spdIconUrl = chrome.runtime.getURL("src/hsr/assets/spd-icon.webp");
    script.dataset.critRateIconUrl = chrome.runtime.getURL("src/hsr/assets/crit-rate-icon.webp");
    script.dataset.critDmgIconUrl = chrome.runtime.getURL("src/hsr/assets/crit-dmg-icon.webp");
    script.dataset.breakIconUrl = chrome.runtime.getURL("src/hsr/assets/break-icon.webp");
    script.dataset.ehrIconUrl = chrome.runtime.getURL("src/hsr/assets/ehr-icon.webp");
    script.dataset.errIconUrl = chrome.runtime.getURL("src/hsr/assets/err-icon.webp");
    script.dataset.healIconUrl = chrome.runtime.getURL("src/hsr/assets/heal-icon.webp");
  }

  function injectSequentially(files, index = 0) {
    if (index >= files.length) {
      return;
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(files[index]);

    if (index === 0) {
      attachDataset(script);
    }

    script.onload = () => {
      script.remove();
      injectSequentially(files, index + 1);
    };
    script.onerror = () => script.remove();

    (document.head || document.documentElement).appendChild(script);
  }

  injectSequentially(INJECTED_FILES);

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (event.data?.type !== "JALKIWOTDA_HSR_SHEET_REQUEST") {
      return;
    }

    const requestId = event.data.requestId;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "JALKIWOTDA_HSR_FETCH_SHEET",
      });

      window.postMessage(
        {
          type: "JALKIWOTDA_HSR_SHEET_RESPONSE",
          requestId,
          ok: Boolean(response?.ok),
          sheet: response?.sheet || null,
          error: response?.error || "",
          source: response?.source || "",
        },
        window.location.origin,
      );
    } catch (error) {
      window.postMessage(
        {
          type: "JALKIWOTDA_HSR_SHEET_RESPONSE",
          requestId,
          ok: false,
          sheet: null,
          error: error?.message || String(error),
        },
        window.location.origin,
      );
    }
  });
})();
