(() => {
  if (window.__JALKIWOTDA_CONTENT_HELPERS__) return;

  function injectSequentially(files, attachDataset, index = 0) {
    if (index >= files.length) return;

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(files[index]);

    if (index === 0) attachDataset(script);

    script.onload = () => {
      script.remove();
      injectSequentially(files, attachDataset, index + 1);
    };
    script.onerror = () => script.remove();

    (document.head || document.documentElement).appendChild(script);
  }

  function installSheetBridge({ requestType, responseType, fetchType, getSheetMessage = () => ({}) }) {
    window.addEventListener("message", async (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type !== requestType) return;

      const requestId = event.data.requestId;
      const startedAt = performance.now();
      const sheetMessage = getSheetMessage(event.data);
      console.info("[jalkiwotda] sheet bridge request", {
        requestType,
        fetchType,
        requestId,
        url: window.location.href,
        payload: sheetMessage,
      });

      try {
        const response = await chrome.runtime.sendMessage({
          type: fetchType,
          ...sheetMessage,
        });
        const elapsedMs = Math.round(performance.now() - startedAt);
        console.info("[jalkiwotda] sheet bridge response", {
          responseType,
          requestId,
          elapsedMs,
          ok: Boolean(response?.ok),
          source: response?.source || "",
          error: response?.error || "",
          rowCount: Array.isArray(response?.sheet?.rows) ? response.sheet.rows.length : null,
        });

        window.postMessage(
          {
            type: responseType,
            requestId,
            ok: Boolean(response?.ok),
            sheet: response?.sheet || null,
            error: response?.error || "",
            source: response?.source || "",
          },
          window.location.origin,
        );
      } catch (error) {
        console.warn("[jalkiwotda] sheet bridge failed", {
          responseType,
          requestId,
          elapsedMs: Math.round(performance.now() - startedAt),
          error: error?.message || String(error),
        });
        window.postMessage(
          {
            type: responseType,
            requestId,
            ok: false,
            sheet: null,
            error: error?.message || String(error),
          },
          window.location.origin,
        );
      }
    });
  }

  function installGameContent(config) {
    if (config.installFlag && window[config.installFlag]) return;
    if (config.installFlag) window[config.installFlag] = true;

    if (!config.shouldInstall()) {
      if (!config.waitForInstall) return;

      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (config.shouldInstall()) {
          window.clearInterval(timer);
          injectSequentially(config.injectedFiles, config.attachDataset);
        } else if (Date.now() - startedAt > (config.waitTimeoutMs || 10_000)) {
          window.clearInterval(timer);
        }
      }, config.waitIntervalMs || 100);
    } else {
      injectSequentially(config.injectedFiles, config.attachDataset);
    }

    installSheetBridge(config.sheetBridge);
  }

  window.__JALKIWOTDA_CONTENT_HELPERS__ = {
    installGameContent,
  };
})();
