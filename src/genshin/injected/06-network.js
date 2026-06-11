(() => {
  const app = window.JALKIWOTDA_GENSHIN;
  if (!app) return;
  const { getUrl, isTarget, parseJson } = app.utils;

  function getCharacters(data) {
    if (!data) return [];
    return data.avatar_list || data.avatars || data.list || data.characters || data.character_list || (data.avatar || data.base || data.name ? [data.avatar || data] : []);
  }

  function getCharacterId(character) {
    const base = character?.base || character || {};
    return String(base.id || character?.id || base.avatar_id || character?.avatar_id || "");
  }

  function saveCharacterOrderIds(characters) {
    const ids = (characters || []).map(getCharacterId).filter(Boolean);
    if (ids.length === 0) return;
    app.state.hoyolabCharacterOrderIds = ids;
    try {
      window.localStorage?.setItem("jalkiwotda-genshin-character-order-ids", JSON.stringify(ids));
    } catch {
      // Ignore storage failures; in-memory order still works for this page session.
    }
  }

  function getRoleInfoFromUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return {
        server: parsed.searchParams.get("server") || "",
        role_id: parsed.searchParams.get("role_id") || "",
      };
    } catch {
      return { server: "", role_id: "" };
    }
  }

  function getRoleInfo(data) {
    const role = data?.role || {};
    const direct = {
      server: role.region || role.server || data?.server || "",
      role_id: role.game_uid || role.role_id || data?.role_id || "",
    };
    if (direct.server && direct.role_id) return direct;

    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      const responseRole = response.body?.data?.role || {};
      const fromBody = {
        server: responseRole.region || responseRole.server || response.body?.data?.server || "",
        role_id: responseRole.game_uid || responseRole.role_id || response.body?.data?.role_id || "",
      };
      if (fromBody.server && fromBody.role_id) return fromBody;

      const fromUrl = getRoleInfoFromUrl(response.url);
      if (fromUrl.server && fromUrl.role_id) return fromUrl;
    }

    return direct;
  }

  function getRpcLanguageHeaders() {
    return {
      "content-type": "application/json",
      "x-rpc-lang": "ko-kr",
      "x-rpc-language": "ko-kr",
    };
  }

  function getLatestListResponse() {
    const listUrls = [
      "/genshin/api/character/list",
      "/game_record/app/genshin/api/character/list",
      "/game_record/genshin/api/character/list",
      "/game_record/genshin/aapi/character/list",
    ];
    const indexUrls = [
      "/genshin/api/index",
      "/game_record/app/genshin/api/index",
      "/game_record/genshin/api/index",
      "/game_record/genshin/aapi/index",
    ];

    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      if (listUrls.some((url) => response.url.includes(url))) return response;
    }

    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      if (indexUrls.some((url) => response.url.includes(url))) return response;
    }

    return null;
  }

  function buildCharacterDetailUrl(listUrl, roleInfo, characterId, style = "brackets") {
    const url = new URL(listUrl, window.location.href);

    if (url.pathname.endsWith("/index")) {
      url.pathname = url.pathname.replace(/\/index$/u, "/character/detail");
    } else if (url.pathname.endsWith("/character/list")) {
      url.pathname = url.pathname.replace(/\/character\/list$/u, "/character/detail");
    } else {
      url.pathname = url.pathname.replace(/\/[^/]*$/u, "/character/detail");
    }

    url.searchParams.set("server", roleInfo.server);
    url.searchParams.set("role_id", roleInfo.role_id);
    url.searchParams.delete("avatar_list_type");
    url.searchParams.delete("character_ids");
    url.searchParams.delete("character_ids[]");

    if (style === "json") {
      url.searchParams.set("character_ids", JSON.stringify([Number(characterId) || characterId]));
    } else if (style === "repeat") {
      url.searchParams.append("character_ids", characterId);
    } else {
      url.searchParams.append("character_ids[]", characterId);
    }

    return url.toString();
  }

  function hasKoreanText(value) {
    return /[가-힣]/.test(JSON.stringify(value || ""));
  }

  function chooseMetadataValue(current, candidate) {
    if (!current) return candidate;
    if (hasKoreanText(current)) return current;
    return hasKoreanText(candidate) ? candidate : current;
  }

  function mergeCharacterData(listData, detailPayloads) {
    if (!listData) return detailPayloads.at(-1) || null;

    const list = getCharacters(listData);
    if (list.length > 0) {
      saveCharacterOrderIds(list);
    }
    if (detailPayloads.length === 0) {
      return list.length > 0 ? { ...listData, jalkiwotda_ordered_characters: list } : listData;
    }

    const detailMetadata = detailPayloads.reduce((metadata, payload) => ({
      ...metadata,
      property_info: chooseMetadataValue(metadata.property_info, payload.property_info),
      property_map: chooseMetadataValue(metadata.property_map, payload.property_map),
      relic_property_options: chooseMetadataValue(metadata.relic_property_options, payload.relic_property_options),
      relic_wiki: chooseMetadataValue(metadata.relic_wiki, payload.relic_wiki),
      weapon_wiki: chooseMetadataValue(metadata.weapon_wiki, payload.weapon_wiki),
      avatar_wiki: chooseMetadataValue(metadata.avatar_wiki, payload.avatar_wiki),
    }), {});

    const detailById = new Map();
    for (const payload of detailPayloads) {
      for (const character of getCharacters(payload)) {
        const id = getCharacterId(character);
        if (id && !detailById.has(id)) detailById.set(id, character);
      }
    }

    if (list.length === 0) return detailPayloads.at(-1) || listData;

    const mergedList = list.map((character) => {
      const detail = detailById.get(getCharacterId(character));
      return detail ? { ...character, ...detail, base: { ...(character.base || {}), ...(detail.base || {}) } } : character;
    });

    return {
      ...listData,
      ...detailMetadata,
      jalkiwotda_ordered_characters: mergedList,
      avatar_list: Array.isArray(listData.avatar_list) ? mergedList : listData.avatar_list,
      avatars: Array.isArray(listData.avatars) ? mergedList : listData.avatars,
      list: Array.isArray(listData.list) ? mergedList : listData.list,
      characters: Array.isArray(listData.characters) ? mergedList : listData.characters,
      character_list: Array.isArray(listData.character_list) ? mergedList : listData.character_list,
    };
  }

  function getLatestDetailData() {
    const fallbackUrls = [
      "/genshin/api/character/list",
      "/game_record/app/genshin/api/character/list",
      "/game_record/genshin/api/character/list",
      "/game_record/genshin/aapi/character/list",
    ];
    const indexUrls = [
      "/genshin/api/index",
      "/game_record/app/genshin/api/index",
      "/game_record/genshin/api/index",
      "/game_record/genshin/aapi/index",
    ];

    const detailPayloads = [];
    let listData = null;

    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      if (response.url.includes("/genshin/api/character/detail") ||
          response.url.includes("/genshin/api/avatarBasicInfo") ||
          response.url.includes("/game_record/app/genshin/api/character/detail") ||
          response.url.includes("/game_record/genshin/api/character/detail") ||
          response.url.includes("/game_record/genshin/aapi/character/detail")) {
        if (response.body?.data) detailPayloads.push(response.body.data);
      }
    }

    for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
      const response = app.state.responses[index];
      if (fallbackUrls.some((url) => response.url.includes(url))) {
        listData = response.body?.data || null;
        break;
      }
    }

    if (!listData) {
      for (let index = app.state.responses.length - 1; index >= 0; index -= 1) {
        const response = app.state.responses[index];
        if (indexUrls.some((url) => response.url.includes(url))) {
          listData = response.body?.data || null;
          break;
        }
      }
    }

    return mergeCharacterData(listData, detailPayloads) || detailPayloads.at(-1) || null;
  }

  async function fetchCharacterDetails(listResponse, roleInfo, characterIds) {
    const detailUrlObject = new URL(buildCharacterDetailUrl(listResponse.url, roleInfo, characterIds[0] || ""));
    detailUrlObject.search = "";
    const detailUrl = detailUrlObject.toString();
    const requestBody = {
      server: roleInfo.server,
      role_id: roleInfo.role_id,
      character_ids: characterIds.map((characterId) => Number(characterId) || characterId),
    };

    const response = await app.state.originals.fetch(detailUrl, {
      method: "POST",
      credentials: "include",
      headers: getRpcLanguageHeaders(),
      body: JSON.stringify(requestBody),
    });
    const text = await response.text();
    recordResponse("auto-detail", detailUrl, response.status, text);

    const body = parseJson(text);
    if (response.ok && body && (body.retcode === 0 || body.message === "OK")) {
      console.debug("[jalkiwotda-genshin] character detail batch fetched", {
        requested: characterIds.length,
        returned: getCharacters(body.data).length,
      });
      return body.data || null;
    }

    throw new Error(body?.message || `HTTP ${response.status}`);
  }

  async function fetchCharacterDetail(listResponse, roleInfo, characterId) {
    try {
      return await fetchCharacterDetails(listResponse, roleInfo, [characterId]);
    } catch (error) {
      let lastError = error;
      const styles = ["brackets", "repeat", "json"];

      for (const style of styles) {
        const url = buildCharacterDetailUrl(listResponse.url, roleInfo, characterId, style);
        try {
          const response = await app.state.originals.fetch(url, { credentials: "include" });
          const text = await response.text();
          recordResponse("auto-detail", url, response.status, text);

          const body = parseJson(text);
          if (response.ok && body && (body.retcode === 0 || body.message === "OK")) {
            return body.data || null;
          }

          lastError = new Error(body?.message || `HTTP ${response.status}`);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("character detail fetch failed");
    }
  }

  async function loadAllCharacterDetails(data, onProgress) {
    const listResponse = getLatestListResponse();
    const roleInfo = getRoleInfo(data);
    const characters = getCharacters(data);
    const ids = characters.map(getCharacterId).filter(Boolean);

    if (!listResponse || !roleInfo.server || !roleInfo.role_id || ids.length === 0) {
      console.warn("[jalkiwotda-genshin] character detail batch skipped", {
        hasListResponse: Boolean(listResponse),
        roleInfo,
        characterCount: ids.length,
      });
      return data;
    }

    const existing = new Set();
    for (const response of app.state.responses) {
      if (!response.url.includes("/character/detail")) continue;
      for (const character of getCharacters(response.body?.data)) {
        const id = getCharacterId(character);
        if (id) existing.add(id);
      }
    }

    const missingIds = ids.filter((id) => !existing.has(id));
    if (missingIds.length === 0) {
      return data;
    }

    try {
      onProgress?.(missingIds.length, missingIds.length);
      const detail = await fetchCharacterDetails(listResponse, roleInfo, missingIds);
      return mergeCharacterData(data, detail ? [detail] : []);
    } catch (error) {
      console.warn("[jalkiwotda-genshin] character detail batch fetch failed", error);
    }

    const detailPayloads = [];
    for (let index = 0; index < missingIds.length; index += 1) {
      onProgress?.(index + 1, missingIds.length);
      try {
        const detail = await fetchCharacterDetail(listResponse, roleInfo, missingIds[index]);
        if (detail) detailPayloads.push(detail);
      } catch (error) {
        console.warn("[jalkiwotda-genshin] character detail auto fetch failed", missingIds[index], error);
      }
    }
    return mergeCharacterData(data, detailPayloads);
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

    window.dispatchEvent(new CustomEvent("jalkiwotda-genshin-response", { detail: payload }));
    console.debug("[jalkiwotda-genshin] captured", source, url, payload.body);
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
            .catch((error) => console.warn("[jalkiwotda-genshin] fetch capture failed", url, error));
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
      this.__jalkiwotdaGenshinUrl = String(url || "");
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function send(...args) {
      this.addEventListener("loadend", () => {
        const url = this.__jalkiwotdaGenshinUrl || this.responseURL || "";
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
    loadAllCharacterDetails,
    clearResponses,
    installFetchHook,
    installXhrHook,
  });
})();
