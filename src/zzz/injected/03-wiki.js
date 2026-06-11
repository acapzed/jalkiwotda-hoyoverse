(() => {
  const app = window.JALKIWOTDA_ZZZ;
  if (!app) return;

  async function loadWikiEquipmentSets() {
    if (!app.state.wikiEquipmentSetsCache) {
      app.state.wikiEquipmentSetsCache = new Map();
    }
    return app.state.wikiEquipmentSetsCache;
  }

  Object.assign(app.wiki, { loadWikiEquipmentSets });
})();
