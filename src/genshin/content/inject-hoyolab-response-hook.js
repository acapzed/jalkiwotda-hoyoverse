(() => {
  const helpers = window.__JALKIWOTDA_CONTENT_HELPERS__;
  if (!helpers) return;

  const SHEET_PAGE_URL =
    "https://docs.google.com/spreadsheets/d/1sjVkeR8s41wW0oTtBHC1at9riOxWqyXPcbJscYI8fdE/edit?gid=1394698652";
  const REPORT_IMAGE_URL =
    "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/11/02/80830045/6e1e5196da96bd65e549abe7fa861915_3748295682316364302.png?x-oss-process=image%2Fformat%2Cwebp";

  function attachDataset(script) {
    script.dataset.sheetPageUrl = SHEET_PAGE_URL;
    script.dataset.reportImageUrl = REPORT_IMAGE_URL;
    script.dataset.statIconUrl = chrome.runtime.getURL("src/genshin/assets/icon-32.png");
    script.dataset.hpIconUrl = chrome.runtime.getURL("src/genshin/assets/hp-icon.webp");
    script.dataset.atkIconUrl = chrome.runtime.getURL("src/genshin/assets/atk-icon.webp");
    script.dataset.defIconUrl = chrome.runtime.getURL("src/genshin/assets/def-icon.webp");
    script.dataset.spdIconUrl = chrome.runtime.getURL("src/genshin/assets/spd-icon.webp");
    script.dataset.critRateIconUrl = chrome.runtime.getURL("src/genshin/assets/crit-rate-icon.webp");
    script.dataset.critDmgIconUrl = chrome.runtime.getURL("src/genshin/assets/crit-dmg-icon.webp");
    script.dataset.breakIconUrl = chrome.runtime.getURL("src/genshin/assets/break-icon.webp");
    script.dataset.ehrIconUrl = chrome.runtime.getURL("src/genshin/assets/ehr-icon.webp");
    script.dataset.errIconUrl = chrome.runtime.getURL("src/genshin/assets/err-icon.webp");
    script.dataset.healIconUrl = chrome.runtime.getURL("src/genshin/assets/heal-icon.webp");
  }

  helpers.installGameContent({
    installFlag: "__JALKIWOTDA_GENSHIN_CONTENT_INSTALLED__",
    shouldInstall: () => window.location.hash === "#/ys",
    waitForInstall: true,
    injectedFiles: [
      "src/genshin/injected/00-bootstrap.js",
      "src/genshin/injected/01-utils.js",
      "src/common/injected/response-capture.js",
      "src/genshin/injected/06-network.js",
      "src/genshin/injected/02-sheet.js",
      "src/genshin/injected/03-wiki.js",
      "src/genshin/injected/04-compare.js",
      "src/genshin/injected/05-render.js",
      "src/genshin/injected/07-panel.js",
      "src/genshin/injected/08-main.js",
    ],
    attachDataset,
    sheetBridge: {
      requestType: "JALKIWOTDA_GENSHIN_SHEET_REQUEST",
      responseType: "JALKIWOTDA_GENSHIN_SHEET_RESPONSE",
      fetchType: "JALKIWOTDA_GENSHIN_FETCH_SHEET",
      getSheetMessage: (data) => ({ sheetVersion: data.sheetVersion || "" }),
    },
  });
})();
