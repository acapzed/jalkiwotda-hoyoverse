(() => {
  if (window.__JALKIWOTDA_GENSHIN_HOOK_INSTALLED__) {
    return;
  }

  window.__JALKIWOTDA_GENSHIN_HOOK_INSTALLED__ = true;

  const dataset = document.currentScript?.dataset || {};

  function readJsonStorage(key, fallback) {
    try {
      return JSON.parse(window.localStorage?.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  window.JALKIWOTDA_GENSHIN = {
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
      maxResponses: 180,
      maxCaptureBytes: 2_000_000,
    },
    constants: {
      targets: [
        "/genshin/api/index",
        "/genshin/api/avatarBasicInfo",
        "/genshin/api/character",
        "/genshin/api/character/list",
        "/genshin/api/character/detail",
        "/game_record/app/genshin/api/character/list",
        "/game_record/app/genshin/api/character/detail",
        "/game_record/app/genshin/api/index",
        "/game_record/card/wapi/getGameRecordCard",
        "/game_record/genshin/api/character/list",
        "/game_record/genshin/api/character/detail",
        "/game_record/genshin/api/index",
        "/game_record/genshin/aapi/character/list",
        "/game_record/genshin/aapi/character/detail",
        "/game_record/genshin/aapi/index",
      ],
      wikiSetListUrl:
        "https://sg-act-public-api.hoyolab.com/hoyowiki/genshin/wapi/get_entry_page_list",
      wikiArtifactSetMenuId: "108",
      wikiPageSize: 30,
      checkWeights: {
        weapon: 2,
        artifactSets: 4,
        artifactExtraSets: 4,
        body: 1,
        feet: 1,
        sphere: 1,
        rope: 1,
      },
      sheetVersions: [
        { id: "jalkiwotda", label: "이정도면잘키웠다" },
        { id: "all-in-one", label: "올인원 준종결표" },
      ],
      aliases: new Map([]),
      travelerElementNames: new Map([
        ["Pyro", "불"],
        ["Fire", "불"],
        ["불", "불"],
        ["Hydro", "물"],
        ["Water", "물"],
        ["물", "물"],
        ["Dendro", "풀"],
        ["Grass", "풀"],
        ["풀", "풀"],
        ["Electro", "번개"],
        ["Electric", "번개"],
        ["번개", "번개"],
        ["Anemo", "바람"],
        ["Wind", "바람"],
        ["바람", "바람"],
        ["Geo", "바위"],
        ["Rock", "바위"],
        ["바위", "바위"],
      ]),
      pathSuffixByBaseType: new Map([
        [1, "파멸"],
        [2, "수렵"],
        [3, "지식"],
        [4, "화합"],
        [5, "공허"],
        [6, "보존"],
        [7, "풍요"],
        [8, "기억"],
        [9, "환락"],
      ]),
      equipmentSetByItemKey: new Map([
        [6102, { label: "거너", aliases: ["거너"] }],
        [6108, { label: "천재", aliases: ["천재", "지니어스"] }],
        [6110, { label: "매", aliases: ["매"] }],
        [6111, { label: "괴도", aliases: ["괴도"] }],
        [6113, { label: "제자", aliases: ["제자"] }],
        [6114, { label: "메신저", aliases: ["메신저"] }],
        [6115, { label: "대공", aliases: ["대공"] }],
        [6116, { label: "죄수", aliases: ["죄수"] }],
        [6117, { label: "선구자", aliases: ["선구자"] }],
        [6118, { label: "시계공", aliases: ["시계공"] }],
        [6119, { label: "철기군", aliases: ["철기군"] }],
        [6120, { label: "용맹", aliases: ["용맹", "현효"] }],
        [6121, { label: "사제", aliases: ["사제"] }],
        [6122, { label: "학자", aliases: ["학자"] }],
        [6124, { label: "시인", aliases: ["시인"] }],
        [6125, { label: "여전사", aliases: ["여전사"] }],
        [6126, { label: "선장", aliases: ["선장"] }],
        [6127, { label: "구세주", aliases: ["구세주"] }],
        [6128, { label: "은둔자", aliases: ["은둔자"] }],
        [6129, { label: "마법소녀", aliases: ["마법소녀", "마법 소녀"] }],
        [6130, { label: "점술가", aliases: ["점술가"] }],
        [6306, { label: "살소토", aliases: ["살소토"] }],
        [6308, { label: "바커공", aliases: ["바커공", "바커 공"] }],
        [6309, { label: "뭇별 경기장", aliases: ["뭇별", "뭇별 경기장"] }],
        [6310, { label: "부러진 용골", aliases: ["부러진 용골", "용골"] }],
        [6314, { label: "이즈모", aliases: ["이즈모"] }],
        [6315, { label: "도람", aliases: ["도람"] }],
        [6316, { label: "연마궁", aliases: ["연마궁"] }],
        [6317, { label: "루샤카", aliases: ["루샤카"] }],
        [6318, { label: "나나 낙원", aliases: ["나나 낙원", "낙원"] }],
        [6319, { label: "습골지", aliases: ["습골지", "아이도니아"] }],
        [6320, { label: "앰포리어스", aliases: ["앰포리어스", "깨달음"] }],
        [6322, { label: "노래", aliases: ["노래"] }],
        [6325, { label: "펑크 로드", aliases: ["펑크 로드"] }],
      ]),
    },
    state: {
      responses: [],
      responseKeys: new Set(),
      hoyolabCharacterOrderIds: readJsonStorage("jalkiwotda-genshin-character-order-ids", []),
      sheetRowsCache: null,
      sheetMetadataCache: null,
      sheetUsesExplicitMerges: false,
      sheetCharactersCache: null,
      sheetVersion: ["jalkiwotda", "all-in-one"].includes(window.localStorage?.getItem("jalkiwotda-genshin-sheet-version"))
        ? window.localStorage.getItem("jalkiwotda-genshin-sheet-version")
        : "jalkiwotda",
      wikiEquipmentSetsCache: null,
      languageWarningShown: false,
      simpleMode: window.localStorage?.getItem("jalkiwotda-genshin-simple-mode") === "1",
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

  const byItem = window.JALKIWOTDA_GENSHIN.constants.equipmentSetByItemKey;
  window.JALKIWOTDA_GENSHIN.constants.equipmentSetByWikiEntry = new Map([
    [135, byItem.get(6110)], [137, byItem.get(6308)], [138, byItem.get(6111)],
    [139, byItem.get(6102)], [145, byItem.get(6108)], [1235, byItem.get(6310)],
    [1236, byItem.get(6113)], [1237, byItem.get(6114)], [1238, byItem.get(6309)],
    [1600, byItem.get(6116)], [1601, byItem.get(6115)], [1925, byItem.get(6117)],
    [1926, byItem.get(6118)], [2372, byItem.get(6314)], [2649, byItem.get(6119)],
    [2650, byItem.get(6315)], [2651, byItem.get(6316)], [2655, byItem.get(6120)],
    [3059, byItem.get(6318)], [3064, byItem.get(6317)], [3161, byItem.get(6122)],
    [3162, byItem.get(6121)], [3343, byItem.get(6124)], [3565, byItem.get(6320)],
    [3566, byItem.get(6319)], [3782, byItem.get(6126)], [3783, byItem.get(6125)],
    [3904, byItem.get(6322)], [4012, byItem.get(6127)], [4013, byItem.get(6128)],
    [4769, byItem.get(6130)], [4770, byItem.get(6129)], [5012, byItem.get(6325)],
  ]);
})();
