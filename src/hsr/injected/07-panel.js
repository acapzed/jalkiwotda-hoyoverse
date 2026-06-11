(() => {
  const app = window.JALKIWOTDA_HSR;
  if (!app) return;
  const { cleanCell } = app.utils;

  function getPageLanguage() {
    return cleanCell(document.documentElement?.lang || document.querySelector("html")?.getAttribute("lang") || "").toLowerCase();
  }

  function isKoreanPageLanguage() {
    const language = getPageLanguage();
    return !language || language.startsWith("ko");
  }

  function collectTextValues(source, values = [], seen = new Set()) {
    if (!source || values.length >= 80 || seen.has(source)) return values;
    if (typeof source === "string" || typeof source === "number") {
      values.push(cleanCell(source));
      return values;
    }
    if (typeof source !== "object") return values;

    seen.add(source);
    for (const [key, value] of Object.entries(source)) {
      if (!/(?:name|property|stat|avatar|relic|equipment|light|cone|desc|type|element)/i.test(key)) continue;
      collectTextValues(value, values, seen);
      if (values.length >= 80) break;
    }
    return values;
  }

  function isLikelyKoreanCharacterData(detailData) {
    const avatar = detailData?.avatar_list?.find((item) => cleanCell(item?.name));
    const propertyInfo = detailData?.property_info || {};
    const propertyNames = Object.values(propertyInfo).map((property) => cleanCell(property?.name)).filter(Boolean);
    const sampledValues = collectTextValues({
      avatar_list: detailData?.avatar_list,
      property_info: detailData?.property_info,
      equipment_info: detailData?.equipment_info,
      relic_info: detailData?.relic_info,
    });
    const sampleText = [avatar?.name, ...propertyNames.slice(0, 8), ...sampledValues].join(" ");
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
    const detailData = app.network.getLatestDetailData();
    const reportButton = document.querySelector('[data-jalkiwotda-hsr-action="report"]');
    const previousButtonText = reportButton?.textContent || "";

    function setReportState(message) {
      if (reportButton) reportButton.textContent = message;
    }

    if (!detailData) {
      alert("아직 캐릭터 정보를 가져오지 못했습니다. HoYoLAB 페이지를 새로고침한 뒤 다시 시도하세요.");
      return;
    }

    if (shouldRequireKoreanLanguage(detailData)) {
      alertKoreanLanguageRequired();
      return;
    }

    try {
      setReportState("기준표 로딩 중...");
      const sheetCharacters = await app.sheet.loadSheetCharacters();
      let wikiSetNames = new Map();

      try {
        setReportState("세트 정보 로딩 중...");
        wikiSetNames = await app.wiki.loadWikiEquipmentSets();
      } catch (error) {
        console.warn("[jalkiwotda-hsr] HoYoWiki set list load failed", error);
      }

      setReportState("리포트 생성 중...");
      const rows = app.compare.buildReportRows(detailData, sheetCharacters, wikiSetNames);
      const modal = app.render.getOrCreateReportModal();
      app.render.renderReportModal(modal, rows);
    } catch (error) {
      console.error("[jalkiwotda-hsr] report load failed", error);
      alert(`리포트를 만들지 못했습니다.\n\n${error?.message || error}`);
    } finally {
      setReportState(previousButtonText || "정오표 보기");
    }
  }

  function updatePanel() {
    const countNode = document.querySelector("[data-jalkiwotda-hsr-count]");
    if (countNode) countNode.textContent = String(app.state.responses.length);
  }

  function installPanel() {
    if (document.getElementById("jalkiwotda-hsr-hook-panel")) return;

    const panel = document.createElement("div");
    panel.id = "jalkiwotda-hsr-hook-panel";
    panel.style.cssText = app.styles.panel;

    panel.innerHTML = [
      app.config.reportImageUrl
        ? `<img src="${app.utils.escapeHtml(app.config.reportImageUrl)}" alt="이잘키 스타레일 정오표" data-jalkiwotda-hsr-image>`
        : "",
      '<span data-jalkiwotda-hsr-count-row>불러온 정보: <b data-jalkiwotda-hsr-count>0</b></span>',
      '<button type="button" data-jalkiwotda-hsr-action="report">정오표 보기</button>',
      '<div data-jalkiwotda-hsr-button-row>',
      '<button type="button" data-jalkiwotda-hsr-action="refresh">새로고침</button>',
      "</div>",
    ].join("");

    const panelImage = panel.querySelector("[data-jalkiwotda-hsr-image]");
    const countRow = panel.querySelector("[data-jalkiwotda-hsr-count-row]");
    const buttonRow = panel.querySelector("[data-jalkiwotda-hsr-button-row]");

    if (panelImage) panelImage.style.cssText = app.styles.panelImage;
    if (countRow) countRow.style.cssText = app.styles.panelCount;
    if (buttonRow) buttonRow.style.cssText = app.styles.panelButtonRow;
    panel.querySelectorAll("button").forEach((button) => { button.style.cssText = app.styles.panelButton; });

    panel.addEventListener("click", async (event) => {
      const action = event.target?.dataset?.jalkiwotdaHsrAction;
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
