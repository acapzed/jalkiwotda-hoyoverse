(() => {
  const app = window.JALKIWOTDA_HSR;
  if (!app) return;
  const { getUrl, isTarget, parseJson } = app.utils;

  function getLatestDetailData() {
    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      if (response.url.includes("/hkrpg/api/avatar/info")) {
        return response.body?.data || null;
      }
    }
    return null;
  }

  function makeResponseKey(url, bodyText) {
    return `${url}:${bodyText.length}:${bodyText.slice(0, 120)}`;
  }

  function trimResponseStore() {
    const overflow = app.state.responses.length - app.config.maxResponses;
    if (overflow <= 0) return;

    const removed = app.state.responses.splice(0, overflow);
    for (const response of removed) {
      if (response.key) app.state.responseKeys.delete(response.key);
    }
  }

  function recordResponse(source, url, status, bodyText) {
    if (!isTarget(url)) return;

    const key = makeResponseKey(url, bodyText);
    if (app.state.responseKeys.has(key)) return;
    app.state.responseKeys.add(key);

    const payload = {
      key,
      source,
      url,
      status,
      capturedAt: new Date().toISOString(),
      body: parseJson(bodyText),
    };

    app.state.responses.push(payload);
    trimResponseStore();
    app.panel.updatePanel?.();

    window.dispatchEvent(new CustomEvent("jalkiwotda-hsr-response", { detail: payload }));
    console.debug("[jalkiwotda-hsr] captured", source, url, payload.body);
  }

  function clearResponses() {
    app.state.responses = [];
    app.state.responseKeys.clear();
    app.panel.updatePanel?.();
  }

  function installFetchHook() {
    if (typeof window.fetch !== "function") return;
    if (app.state.originals.fetch) return;

    const originalFetch = window.fetch.bind(window);
    app.state.originals.fetch = originalFetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = getUrl(args[0]) || response.url || "";

      if (isTarget(url)) {
        const contentLength = Number(response.headers?.get?.("content-length") || 0);
        if (!contentLength || contentLength <= app.config.maxCaptureBytes) {
          response.clone().text()
            .then((bodyText) => recordResponse("fetch", url, response.status, bodyText))
            .catch((error) => console.warn("[jalkiwotda-hsr] fetch capture failed", url, error));
        }
      }

      return response;
    };
  }

  function installXhrHook() {
    if (app.state.originals.xhrOpen || app.state.originals.xhrSend) return;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    app.state.originals.xhrOpen = originalOpen;
    app.state.originals.xhrSend = originalSend;

    XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
      this.__jalkiwotdaHsrUrl = String(url || "");
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function send(...args) {
      this.addEventListener("loadend", () => {
        const url = this.__jalkiwotdaHsrUrl || this.responseURL || "";
        if (!isTarget(url)) return;
        if (this.responseType && this.responseType !== "text") return;
        if (typeof this.responseText === "string" && this.responseText.length > app.config.maxCaptureBytes) return;
        recordResponse("xhr", url, this.status, this.responseText || "");
      });

      return originalSend.apply(this, args);
    };
  }

  Object.assign(app.network, {
    getLatestDetailData,
    clearResponses,
    installFetchHook,
    installXhrHook,
  });
})();
