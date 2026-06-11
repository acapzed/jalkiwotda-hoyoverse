(() => {
  const app = window.JALKIWOTDA_GENSHIN;
  if (!app) return;
  const { cleanCell } = app.utils;

  function getPageLanguage() {
    const html = document.documentElement || document.querySelector("html");
    return cleanCell(
      html?.getAttribute("mi18n-lang") ||
      html?.getAttribute("lang") ||
      "",
    ).toLowerCase();
  }

  function isKoreanPageLanguage() {
    const language = getPageLanguage();
    return !language || language.startsWith("ko");
  }

  function isLikelyKoreanCharacterData(detailData) {
    const characters = detailData?.avatar_list || detailData?.avatars || detailData?.list || detailData?.characters || [];
    const avatar = characters.find((item) => cleanCell(item?.base?.name || item?.name));
    const propertyInfo = detailData?.property_info || detailData?.property_map || {};
    const propertyNames = [
      ...Object.values(propertyInfo).map((property) => cleanCell(property?.name)),
      ...((avatar?.base || avatar)?.base_properties || []).map((property) => cleanCell(property?.name)),
      ...((avatar?.base || avatar)?.extra_properties || []).map((property) => cleanCell(property?.name)),
      ...((avatar?.base || avatar)?.element_properties || []).map((property) => cleanCell(property?.name)),
    ].filter(Boolean);
    const sampleText = [avatar?.base?.name || avatar?.name, ...propertyNames.slice(0, 8)].join(" ");
    return /[가-힣]/.test(sampleText);
  }

  function shouldRequireKoreanLanguage(detailData) {
    return !isKoreanPageLanguage() && !isLikelyKoreanCharacterData(detailData);
  }

  function alertKoreanLanguageRequired() {
    app.state.languageWarningShown = true;
    alert(
      "HoYoLAB 언어가 한국어가 아니면 캐릭터 이름과 스탯명이 영어로 들어와 기준표와 매칭되지 않습니다.\n\nHoYoLAB 언어를 한국어로 바꾼 뒤 페이지를 새로고침해 주세요.",
    );
  }

  async function showReport() {
    let detailData = app.network.getLatestDetailData();
    const reportButton = document.querySelector('[data-jalkiwotda-genshin-action="report"]');
    const previousButtonText = reportButton?.textContent || "";
    const getCharacterCount = (data) =>
      (data?.jalkiwotda_ordered_characters ||
        data?.avatar_list ||
        data?.avatars ||
        data?.list ||
        data?.characters ||
        data?.character_list ||
        []).length;

    function setReportState(message) {
      if (reportButton) reportButton.textContent = message;
    }

    console.debug("[jalkiwotda-genshin] report requested", {
      captured: app.state.responses.length,
      characterCount: getCharacterCount(detailData),
      urls: app.state.responses.slice(-8).map((response) => response.url),
    });

    if (!detailData) {
      alert("아직 캐릭터 정보를 가져오지 못했습니다. HoYoLAB 페이지를 새로고침한 뒤 다시 시도하세요.");
      return;
    }

    try {
      try {
        setReportState("캐릭터 상세 로딩 중...");
        detailData = await app.network.loadAllCharacterDetails(detailData, (done, total) => {
          setReportState(`캐릭터 상세 로딩 중... ${done}/${total}`);
        });
        console.debug("[jalkiwotda-genshin] detail data ready", {
          captured: app.state.responses.length,
          characterCount: getCharacterCount(detailData),
        });
      } catch (error) {
        console.warn("[jalkiwotda-genshin] character detail load failed", error);
      }

      if (shouldRequireKoreanLanguage(detailData)) {
        alertKoreanLanguageRequired();
        return;
      }

      setReportState("기준표 로딩 중...");
      const sheetCharacters = await app.sheet.loadSheetCharacters();
      console.debug("[jalkiwotda-genshin] sheet data ready", {
        sheetCharacters: sheetCharacters.length,
        sheetTitle: app.state.sheetMetadataCache?.title || "",
        sheetVersion: app.state.sheetMetadataCache?.version || app.state.sheetVersion,
      });
      let wikiSetNames = new Map();

      try {
        setReportState("세트 정보 로딩 중...");
        wikiSetNames = await app.wiki.loadWikiEquipmentSets();
      } catch (error) {
        console.warn("[jalkiwotda-genshin] HoYoWiki set list load failed", error);
      }

      setReportState("리포트 생성 중...");
      const rows = app.compare.buildReportRows(detailData, sheetCharacters, wikiSetNames);
      console.debug("[jalkiwotda-genshin] report rows built", {
        rows: rows.length,
        matched: rows.filter((row) => row.matched).length,
      });
      const modal = app.render.getOrCreateReportModal();
      app.render.renderReportModal(modal, rows);
    } catch (error) {
      console.error("[jalkiwotda-genshin] report load failed", error);
      alert(`리포트를 만들지 못했습니다.\n\n${error?.message || error}`);
    } finally {
      setReportState(previousButtonText || "정오표 보기");
    }
  }

  function updatePanel() {
    const countNode = document.querySelector("[data-jalkiwotda-genshin-count]");
    if (countNode) countNode.textContent = String(app.state.responses.length);
    const versionSelect = document.querySelector("[data-jalkiwotda-genshin-sheet-version]");
    if (versionSelect && versionSelect.value !== app.state.sheetVersion) {
      versionSelect.value = app.state.sheetVersion;
    }
  }

  function installPanel() {
    if (document.getElementById("jalkiwotda-genshin-hook-panel")) return;

    const panel = document.createElement("div");
    panel.id = "jalkiwotda-genshin-hook-panel";
    panel.style.cssText = app.styles.panel;

    panel.innerHTML = [
      app.config.reportImageUrl
        ? `<img src="${app.utils.escapeHtml(app.config.reportImageUrl)}" alt="이잘키 원신 정오표" data-jalkiwotda-genshin-image>`
        : "",
      '<span data-jalkiwotda-genshin-count-row>불러온 정보: <b data-jalkiwotda-genshin-count>0</b></span>',
      [
        '<select aria-label="기준표 버전" data-jalkiwotda-genshin-sheet-version>',
        ...app.constants.sheetVersions.map((version) =>
          `<option value="${app.utils.escapeHtml(version.id)}">${app.utils.escapeHtml(version.label)}</option>`),
        "</select>",
      ].join(""),
      '<button type="button" data-jalkiwotda-genshin-action="report">정오표 보기</button>',
      '<div data-jalkiwotda-genshin-button-row>',
      '<button type="button" data-jalkiwotda-genshin-action="refresh">새로고침</button>',
      "</div>",
    ].join("");

    const panelImage = panel.querySelector("[data-jalkiwotda-genshin-image]");
    const countRow = panel.querySelector("[data-jalkiwotda-genshin-count-row]");
    const buttonRow = panel.querySelector("[data-jalkiwotda-genshin-button-row]");
    const versionSelect = panel.querySelector("[data-jalkiwotda-genshin-sheet-version]");

    if (panelImage) panelImage.style.cssText = app.styles.panelImage;
    if (countRow) countRow.style.cssText = app.styles.panelCount;
    if (buttonRow) buttonRow.style.cssText = app.styles.panelButtonRow;
    if (versionSelect) {
      versionSelect.style.cssText = app.styles.panelSelect;
      versionSelect.value = app.state.sheetVersion;
    }
    panel.querySelectorAll("button").forEach((button) => { button.style.cssText = app.styles.panelButton; });

    panel.addEventListener("change", (event) => {
      if (!event.target?.matches("[data-jalkiwotda-genshin-sheet-version]")) return;
      app.state.sheetVersion = event.target.value;
      window.localStorage?.setItem("jalkiwotda-genshin-sheet-version", app.state.sheetVersion);
      app.state.sheetRowsCache = null;
      app.state.sheetMetadataCache = null;
      app.state.sheetCharactersCache = null;
      app.state.sheetUsesExplicitMerges = false;
    });

    panel.addEventListener("click", async (event) => {
      const action = event.target?.dataset?.jalkiwotdaGenshinAction;
      if (action === "refresh") {
        app.network.clearResponses();
        window.location.reload();
      } else if (action === "report") {
        await showReport();
      }
    });

    document.body.appendChild(panel);
    updatePanel();
  }

  function installPanelWhenReady() {
    if (document.body) {
      installPanel();
      return;
    }
    window.addEventListener("DOMContentLoaded", installPanel, { once: true });
  }

  Object.assign(app.panel, { updatePanel, installPanelWhenReady, showReport });
})();
