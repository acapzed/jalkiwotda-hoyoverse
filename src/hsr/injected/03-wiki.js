(() => {
  const app = window.JALKIWOTDA_HSR;
  if (!app) return;
  const { cleanCell } = app.utils;

  async function fetchWikiSetPage(pageNum) {
    const response = await fetch(app.constants.wikiSetListUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rpc-language": "ko-kr",
        "x-rpc-wiki_app": "hsr",
      },
      body: JSON.stringify({
        filters: [],
        menu_id: app.constants.wikiRelicSetMenuId,
        page_num: pageNum,
        page_size: app.constants.wikiPageSize,
        use_es: true,
      }),
    });

    if (!response.ok) throw new Error(`HoYoWiki set list failed: HTTP ${response.status}`);

    const payload = await response.json();
    if (payload.retcode !== 0) {
      throw new Error(`HoYoWiki set list failed: ${payload.message || payload.retcode}`);
    }

    return payload.data || {};
  }

  async function loadWikiEquipmentSets() {
    if (app.state.wikiEquipmentSetsCache) return app.state.wikiEquipmentSetsCache;

    const firstPage = await fetchWikiSetPage(1);
    const total = Number(firstPage.total || 0);
    const pages = Math.max(1, Math.ceil(total / app.constants.wikiPageSize));
    const list = [...(firstPage.list || [])];

    for (let pageNum = 2; pageNum <= pages; pageNum += 1) {
      const page = await fetchWikiSetPage(pageNum);
      list.push(...(page.list || []));
    }

    app.state.wikiEquipmentSetsCache = new Map(
      list
        .map((entry) => [Number(entry.entry_page_id), cleanCell(entry.name)])
        .filter(([id, name]) => id && name),
    );

    return app.state.wikiEquipmentSetsCache;
  }

  Object.assign(app.wiki, { loadWikiEquipmentSets });
})();
