(() => {
  const helpers = window.__JALKIWOTDA_CONTENT_HELPERS__;
  if (!helpers) return;

  const SHEET_PAGE_URL =
    "https://docs.google.com/spreadsheets/d/1C3ZpKCTQJXFwUBgZKZRdLOvGqDGlVijb/edit?gid=2007866856#gid=2007866856";
  const REPORT_IMAGE_URL =
    "https://act-webstatic.hoyoverse.com/event-static-hoyowiki-admin/2025/06/23/2c63db4475cf55ee75cfd3b15c4fe547_569101222175571896.png?x-oss-process=image%2Fformat%2Cwebp";

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

  helpers.installGameContent({
    installFlag: "__JALKIWOTDA_ZZZ_CONTENT_INSTALLED__",
    shouldInstall: () => window.location.pathname === "/app/zzz-game-record/index.html" && window.location.hash.startsWith("#/zzz"),
    waitForInstall: true,
    injectedFiles: [
      "src/zzz/injected/00-bootstrap.js",
      "src/zzz/injected/01-utils.js",
      "src/common/injected/response-capture.js",
      "src/zzz/injected/06-network.js",
      "src/zzz/injected/02-sheet.js",
      "src/zzz/injected/03-wiki.js",
      "src/zzz/injected/04-compare.js",
      "src/zzz/injected/05-render.js",
      "src/zzz/injected/07-panel.js",
      "src/zzz/injected/08-main.js",
    ],
    attachDataset,
    sheetBridge: {
      requestType: "JALKIWOTDA_ZZZ_SHEET_REQUEST",
      responseType: "JALKIWOTDA_ZZZ_SHEET_RESPONSE",
      fetchType: "JALKIWOTDA_ZZZ_FETCH_SHEET",
    },
  });
})();
