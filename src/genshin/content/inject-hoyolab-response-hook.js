(() => {
  if (window.__JALKIWOTDA_GENSHIN_CONTENT_INSTALLED__) {
    return;
  }

  window.__JALKIWOTDA_GENSHIN_CONTENT_INSTALLED__ = true;

  const SHEET_PAGE_URL =
    "https://docs.google.com/spreadsheets/d/1sjVkeR8s41wW0oTtBHC1at9riOxWqyXPcbJscYI8fdE/edit?gid=1394698652";
  const REPORT_IMAGE_URL =
    "https://upload-static.hoyoverse.com/hoyolab-wiki/2022/11/02/80830045/6e1e5196da96bd65e549abe7fa861915_3748295682316364302.png?x-oss-process=image%2Fformat%2Cwebp";

  const INJECTED_FILES = [
    "src/genshin/injected/00-bootstrap.js",
    "src/genshin/injected/01-utils.js",
    "src/genshin/injected/02-sheet.js",
    "src/genshin/injected/03-wiki.js",
    "src/genshin/injected/04-compare.js",
    "src/genshin/injected/05-render.js",
    "src/genshin/injected/06-network.js",
    "src/genshin/injected/07-panel.js",
    "src/genshin/injected/08-main.js",
  ];

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

  function isGenshinRoute() {
    return window.location.hash === "#/ys";
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

  function install() {
    injectSequentially(INJECTED_FILES);
  }

  function installWhenGenshinRoute() {
    if (isGenshinRoute()) {
      install();
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (isGenshinRoute()) {
        window.clearInterval(timer);
        install();
      } else if (Date.now() - startedAt > 10_000) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  installWhenGenshinRoute();

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (event.data?.type !== "JALKIWOTDA_GENSHIN_SHEET_REQUEST") {
      return;
    }

    const requestId = event.data.requestId;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "JALKIWOTDA_GENSHIN_FETCH_SHEET",
        sheetVersion: event.data.sheetVersion || "",
      });

      window.postMessage(
        {
          type: "JALKIWOTDA_GENSHIN_SHEET_RESPONSE",
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
          type: "JALKIWOTDA_GENSHIN_SHEET_RESPONSE",
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
