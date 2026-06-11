(() => {
  if (window.__JALKIWOTDA_ZZZ_HOOK_INSTALLED__) {
    return;
  }

  window.__JALKIWOTDA_ZZZ_HOOK_INSTALLED__ = true;

  const dataset = document.currentScript?.dataset || {};

  window.JALKIWOTDA_ZZZ = {
    config: {
      sheetPageUrl: dataset.sheetPageUrl || "",
      reportImageUrl: dataset.reportImageUrl || "",
      statIconUrl: dataset.statIconUrl || "",
      hpIconUrl: dataset.hpIconUrl || "",
      atkIconUrl: dataset.atkIconUrl || "",
      defIconUrl: dataset.defIconUrl || "",
      spdIconUrl: dataset.spdIconUrl || "",
      critRateIconUrl: dataset.critRateIconUrl || "",
      critDmgIconUrl: dataset.critDmgIconUrl || "",
      breakIconUrl: dataset.breakIconUrl || "",
      ehrIconUrl: dataset.ehrIconUrl || "",
      errIconUrl: dataset.errIconUrl || "",
      healIconUrl: dataset.healIconUrl || "",
      maxResponses: 80,
      maxCaptureBytes: 8_000_000,
    },
    constants: {
      targets: [
        "/event/game_record_zzz",
        "/game_record_zzz",
        "/game_record/app/zzz",
        "/game_record/zzz",
        "/zzz/api",
        "/nap/api",
        "/card/wapi/getGameRecordCard",
      ],
      wikiSetListUrl: "",
      wikiRelicSetMenuId: "",
      wikiPageSize: 30,
      checkWeights: {
        lightCone: 2,
        relicSets: 4,
        ornamentSets: 2,
        body: 1,
        feet: 1,
        sphere: 1,
        rope: 0,
      },
      aliases: new Map(),
      pathSuffixByBaseType: new Map(),
      equipmentSetByItemKey: new Map(),
    },
    state: {
      responses: [],
      responseKeys: new Set(),
      sheetCharactersCache: null,
      sheetMetadataCache: null,
      sheetRowsCache: null,
      sheetUsesExplicitMerges: false,
      wikiEquipmentSetsCache: null,
      languageWarningShown: false,
      simpleMode: window.localStorage?.getItem("jalkiwotda-zzz-simple-mode") === "1",
      originals: {},
    },
    styles: {},
    utils: {},
    sheet: {},
    wiki: {},
    compare: {},
    render: {},
    network: {},
    panel: {},
  };

  window.JALKIWOTDA_ZZZ.constants.equipmentSetByWikiEntry = new Map();
})();
