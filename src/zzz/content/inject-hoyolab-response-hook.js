(() => {
  function isZZZRecordPage() {
    return window.location.pathname === "/app/zzz-game-record/index.html" &&
      window.location.hash.startsWith("#/zzz");
  }

  if (!isZZZRecordPage()) {
    return;
  }

  const SHEET_PAGE_URL =
    "https://docs.google.com/spreadsheets/d/1C3ZpKCTQJXFwUBgZKZRdLOvGqDGlVijb/edit?gid=2007866856#gid=2007866856";
  const REPORT_IMAGE_URL =
    "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/06/23/2c63db4475cf55ee75cfd3b15c4fe547_569101222175571896.png?x-oss-process=image%2Fformat%2Cwebp";

  const INJECTED_FILES = [
    "src/zzz/injected/00-bootstrap.js",
    "src/zzz/injected/01-utils.js",
    "src/zzz/injected/02-sheet.js",
    "src/zzz/injected/03-wiki.js",
    "src/zzz/injected/04-compare.js",
    "src/zzz/injected/05-render.js",
    "src/zzz/injected/06-network.js",
    "src/zzz/injected/07-panel.js",
    "src/zzz/injected/08-main.js",
  ];

  function attachDataset(script) {
    script.dataset.sheetPageUrl = SHEET_PAGE_URL;
    script.dataset.reportImageUrl = REPORT_IMAGE_URL;
    script.dataset.statIconUrl = chrome.runtime.getURL("src/zzz/assets/icon-32.png");
    script.dataset.hpIconUrl = chrome.runtime.getURL("src/zzz/assets/hp-icon.webp");
    script.dataset.atkIconUrl = chrome.runtime.getURL("src/zzz/assets/atk-icon.webp");
    script.dataset.defIconUrl = chrome.runtime.getURL("src/zzz/assets/def-icon.webp");
    script.dataset.spdIconUrl = chrome.runtime.getURL("src/zzz/assets/spd-icon.webp");
    script.dataset.critRateIconUrl = chrome.runtime.getURL("src/zzz/assets/crit-rate-icon.webp");
    script.dataset.critDmgIconUrl = chrome.runtime.getURL("src/zzz/assets/crit-dmg-icon.webp");
    script.dataset.breakIconUrl = chrome.runtime.getURL("src/zzz/assets/break-icon.webp");
    script.dataset.ehrIconUrl = chrome.runtime.getURL("src/zzz/assets/ehr-icon.webp");
    script.dataset.errIconUrl = chrome.runtime.getURL("src/zzz/assets/err-icon.webp");
    script.dataset.healIconUrl = chrome.runtime.getURL("src/zzz/assets/heal-icon.webp");
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

    if (event.data?.type !== "JALKIWOTDA_ZZZ_SHEET_REQUEST") {
      return;
    }

    const requestId = event.data.requestId;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "JALKIWOTDA_ZZZ_FETCH_SHEET",
      });

      window.postMessage(
        {
          type: "JALKIWOTDA_ZZZ_SHEET_RESPONSE",
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
          type: "JALKIWOTDA_ZZZ_SHEET_RESPONSE",
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
