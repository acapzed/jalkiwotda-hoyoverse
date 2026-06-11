(() => {
  const app = window.JALKIWOTDA_ZZZ;
  if (!app) return;
  const { getUrl, isTarget, parseJson } = app.utils;

  function hasCharacterList(data) {
    return Array.isArray(data?.avatar_list) ||
      Array.isArray(data?.agent_list) ||
      Array.isArray(data?.avatars) ||
      Array.isArray(data?.agents) ||
      Array.isArray(data?.characters) ||
      Array.isArray(data?.character_list);
  }

  function getCharacters(data) {
    return data?.avatar_list ||
      data?.agent_list ||
      data?.avatars ||
      data?.agents ||
      data?.characters ||
      data?.character_list ||
      [];
  }

  function hasDetailedCharacters(data) {
    return getCharacters(data).some((character) =>
      character?.weapon ||
      character?.equip ||
      character?.equip_list ||
      character?.equipment ||
      character?.properties ||
      character?.property_list,
    );
  }

  function isDetailedCharacter(character) {
    return Boolean(
      character?.weapon ||
      character?.equip ||
      character?.equip_list ||
      character?.equipment ||
      character?.properties ||
      character?.property_list,
    );
  }

  function getAvatarId(character) {
    return character?.id || character?.avatar_id || character?.agent_id || "";
  }

  function isAvatarBasicUrl(url) {
    return String(url || "").includes("/event/game_record_zzz/api/zzz/avatar/basic");
  }

  function isAvatarInfoUrl(url) {
    return String(url || "").includes("/event/game_record_zzz/api/zzz/avatar/info");
  }

  function mergeCharacterData(listData, detailPayloads) {
    if (!listData) return detailPayloads.at(-1) || null;

    const list = getCharacters(listData);
    if (detailPayloads.length === 0) return listData;

    const detailById = new Map();
    for (const payload of detailPayloads) {
      for (const character of getCharacters(payload)) {
        const id = String(getAvatarId(character));
        if (id && !detailById.has(id)) detailById.set(id, character);
      }
    }

    const mergedList = list.map((character) => {
      const detail = detailById.get(String(getAvatarId(character)));
      return detail ? { ...character, ...detail } : character;
    });

    const detailMetadata = detailPayloads.reduce((metadata, payload) => ({
      ...metadata,
      equip_wiki: metadata.equip_wiki || payload.equip_wiki,
      weapon_wiki: metadata.weapon_wiki || payload.weapon_wiki,
      avatar_wiki: metadata.avatar_wiki || payload.avatar_wiki,
      strategy_wiki: metadata.strategy_wiki || payload.strategy_wiki,
      cultivate_index: metadata.cultivate_index || payload.cultivate_index,
      cultivate_equip: metadata.cultivate_equip || payload.cultivate_equip,
      special_skill_icon: metadata.special_skill_icon || payload.special_skill_icon,
    }), {});

    return {
      ...listData,
      ...detailMetadata,
      avatar_list: Array.isArray(listData.avatar_list) ? mergedList : listData.avatar_list,
      agent_list: Array.isArray(listData.agent_list) ? mergedList : listData.agent_list,
      avatars: Array.isArray(listData.avatars) ? mergedList : listData.avatars,
      agents: Array.isArray(listData.agents) ? mergedList : listData.agents,
      characters: Array.isArray(listData.characters) ? mergedList : listData.characters,
      character_list: Array.isArray(listData.character_list) ? mergedList : listData.character_list,
    };
  }

  function findCharacterPayload(source, depth = 0, seen = new Set()) {
    if (!source || depth > 8 || seen.has(source)) return null;
    if (typeof source !== "object") return null;
    seen.add(source);

    if (hasCharacterList(source)) return source;

    for (const value of Object.values(source)) {
      if (!value || typeof value !== "object") continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findCharacterPayload(item, depth + 1, seen);
          if (found) return found;
        }
      } else {
        const found = findCharacterPayload(value, depth + 1, seen);
        if (found) return found;
      }
    }
    return null;
  }

  function getLatestDetailData() {
    const detailPayloads = [];
    let listData = null;
    let fallbackData = null;

    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      const found = findCharacterPayload(response.body?.data) || findCharacterPayload(response.body);
      if (!found) continue;

      if (isAvatarInfoUrl(response.url)) {
        detailPayloads.push(found);
      } else if (!listData && isAvatarBasicUrl(response.url)) {
        listData = found;
      } else if (!fallbackData) {
        fallbackData = found;
      }
    }

    return mergeCharacterData(listData || fallbackData, detailPayloads) || null;
  }

  function getLatestCharacterResponse() {
    let fallback = null;

    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      const found = findCharacterPayload(response.body?.data) || findCharacterPayload(response.body);
      if (!found) continue;
      if (isAvatarBasicUrl(response.url)) return { response, data: found };
      if (!fallback && !isAvatarInfoUrl(response.url)) fallback = { response, data: found };
    }
    return fallback;
  }

  function getCaptureDiagnostics() {
    return {
      captured: app.state.responses.length,
      urls: app.state.responses.slice(-8).map((response) => response.url),
      hasJson: app.state.responses.some((response) => Boolean(response.body)),
    };
  }

  function makeResponseKey(url, bodyText) {
    return `${url}:${bodyText.length}:${bodyText.slice(0, 120)}`;
  }

  function headersToObject(headers) {
    const result = {};
    if (!headers) return result;

    if (typeof Headers === "function" && headers instanceof Headers) {
      headers.forEach((value, key) => { result[key] = value; });
      return result;
    }

    if (Array.isArray(headers)) {
      for (const [key, value] of headers) result[key] = value;
      return result;
    }

    if (typeof headers === "object") {
      for (const [key, value] of Object.entries(headers)) result[key] = value;
    }

    return result;
  }

  function extractFetchRequestHeaders(input, init) {
    return {
      ...headersToObject(input?.headers),
      ...headersToObject(init?.headers),
    };
  }

  function trimResponseStore() {
    const overflow = app.state.responses.length - app.config.maxResponses;
    if (overflow <= 0) return;

    const removed = app.state.responses.splice(0, overflow);
    for (const response of removed) {
      if (response.key) app.state.responseKeys.delete(response.key);
    }
  }

  function recordResponse(source, url, status, bodyText, requestHeaders = {}) {
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
      requestHeaders,
      body: parseJson(bodyText),
    };

    app.state.responses.push(payload);
    trimResponseStore();
    app.panel.updatePanel?.();

    window.dispatchEvent(new CustomEvent("jalkiwotda-zzz-response", { detail: payload }));
    console.debug("[jalkiwotda-zzz] captured", source, url, payload.body);
  }

  function clearResponses() {
    app.state.responses = [];
    app.state.responseKeys.clear();
    app.panel.updatePanel?.();
  }

  function extractRoleParams(url) {
    try {
      const parsed = new URL(url, window.location.href);
      const server = parsed.searchParams.get("server") || parsed.searchParams.get("region") || "";
      const roleId = parsed.searchParams.get("role_id") || parsed.searchParams.get("uid") || "";
      if (!server || !roleId) return null;
      return { server, roleId };
    } catch {
      return null;
    }
  }

  function buildAvatarInfoUrl(params, id) {
    const url = new URL("https://sg-act-public-api.hoyolab.com/event/game_record_zzz/api/zzz/avatar/info");
    url.searchParams.append("id_list[]", id);
    url.searchParams.set("need_wiki", "true");
    url.searchParams.set("server", params.server);
    url.searchParams.set("role_id", params.roleId);
    return url.href;
  }

  function buildAvatarBasicUrl(params) {
    const url = new URL("https://sg-act-public-api.hoyolab.com/event/game_record_zzz/api/zzz/avatar/basic");
    url.searchParams.set("server", params.server);
    url.searchParams.set("role_id", params.roleId);
    return url.href;
  }

  function buildReplayHeaders(requestHeaders = {}) {
    const allowed = {};
    for (const [key, value] of Object.entries(requestHeaders)) {
      const name = key.toLowerCase();
      if (!/^x-rpc-|^accept$|^accept-language$/.test(name)) continue;
      allowed[key] = value;
    }
    if (!Object.keys(allowed).some((key) => key.toLowerCase() === "x-rpc-language")) {
      allowed["x-rpc-language"] = "ko-kr";
    }
    if (!Object.keys(allowed).some((key) => key.toLowerCase() === "x-rpc-lang")) {
      allowed["x-rpc-lang"] = "ko-kr";
    }
    return allowed;
  }

  async function fetchGameRecordData(url, requestHeaders, source) {
    const fetcher = app.state.originals.fetch || window.fetch.bind(window);
    const response = await fetcher(url, {
      credentials: "include",
      headers: buildReplayHeaders(requestHeaders),
    });
    const bodyText = await response.clone().text();
    recordResponse(source, url, response.status, bodyText, requestHeaders);

    const body = parseJson(bodyText);
    if (!body || body.retcode !== 0 || !body.data) {
      throw new Error(body?.message || `${source} request failed (${response.status})`);
    }
    return body.data;
  }

  async function fetchAvatarBasic(url, requestHeaders) {
    return fetchGameRecordData(url, requestHeaders, "basic-fetch");
  }

  async function fetchAvatarInfo(url, requestHeaders) {
    return fetchGameRecordData(url, requestHeaders, "detail-fetch");
  }

  async function fetchAvatarInfoDetails(params, ids, requestHeaders) {
    const detailPayloads = [];
    const concurrency = 4;
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < ids.length) {
        const id = ids[nextIndex];
        nextIndex += 1;
        try {
          const data = await fetchAvatarInfo(buildAvatarInfoUrl(params, id), requestHeaders);
          detailPayloads.push(data);
        } catch (error) {
          console.warn("[jalkiwotda-zzz] avatar detail fetch failed", id, error);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
    return detailPayloads;
  }

  async function getBestDetailData() {
    const latest = getLatestCharacterResponse();
    if (!latest) return null;

    const mergedData = getLatestDetailData() || latest.data;
    const mergedCharacters = getCharacters(mergedData);
    if (mergedCharacters.length > 0 && mergedCharacters.every(isDetailedCharacter)) return mergedData;

    if (app.state.detailRequestPromise) return app.state.detailRequestPromise;

    app.state.detailRequestPromise = (async () => {
      const params = extractRoleParams(latest.response.url);
      if (!params) return mergedData;

      const listData = isAvatarBasicUrl(latest.response.url)
        ? mergedData
        : await fetchAvatarBasic(buildAvatarBasicUrl(params), latest.response.requestHeaders);
      const listWithKnownDetails = mergeCharacterData(listData, [mergedData]) || listData;
      const ids = getCharacters(listWithKnownDetails)
        .filter((character) => !isDetailedCharacter(character))
        .map(getAvatarId)
        .filter(Boolean);
      if (ids.length === 0) return listWithKnownDetails;

      const detailPayloads = await fetchAvatarInfoDetails(params, ids, latest.response.requestHeaders);
      return mergeCharacterData(listWithKnownDetails, detailPayloads) || listWithKnownDetails;
    })().catch((error) => {
      console.warn("[jalkiwotda-zzz] avatar detail auto fetch failed", error);
      return mergedData;
    }).finally(() => {
      app.state.detailRequestPromise = null;
    });

    return app.state.detailRequestPromise;
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
        const requestHeaders = extractFetchRequestHeaders(args[0], args[1]);
        const contentLength = Number(response.headers?.get?.("content-length") || 0);
        if (!contentLength || contentLength <= app.config.maxCaptureBytes) {
          response.clone().text()
            .then((bodyText) => recordResponse("fetch", url, response.status, bodyText, requestHeaders))
            .catch((error) => console.warn("[jalkiwotda-zzz] fetch capture failed", url, error));
        }
      }

      return response;
    };
  }

  function installXhrHook() {
    if (app.state.originals.xhrOpen || app.state.originals.xhrSend) return;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    app.state.originals.xhrOpen = originalOpen;
    app.state.originals.xhrSend = originalSend;
    app.state.originals.xhrSetRequestHeader = originalSetRequestHeader;

    XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
      this.__jalkiwotdaZzzUrl = String(url || "");
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.setRequestHeader = function setRequestHeader(name, value) {
      this.__jalkiwotdaZzzHeaders = this.__jalkiwotdaZzzHeaders || {};
      this.__jalkiwotdaZzzHeaders[name] = value;
      return originalSetRequestHeader.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function send(...args) {
      this.addEventListener("loadend", () => {
        const url = this.__jalkiwotdaZzzUrl || this.responseURL || "";
        if (!isTarget(url)) return;
        if (this.responseType && this.responseType !== "text") return;
        if (typeof this.responseText === "string" && this.responseText.length > app.config.maxCaptureBytes) return;
        recordResponse("xhr", url, this.status, this.responseText || "", this.__jalkiwotdaZzzHeaders || {});
      });

      return originalSend.apply(this, args);
    };
  }

  Object.assign(app.network, {
    getLatestDetailData,
    getBestDetailData,
    getCaptureDiagnostics,
    clearResponses,
    installFetchHook,
    installXhrHook,
  });
})();
