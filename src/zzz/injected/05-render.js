(() => {
  const app = window.JALKIWOTDA_ZZZ;
  if (!app) return;
  const { cleanCell, escapeHtml, normalizeCompareText } = app.utils;

  function getReportTotals(rows) {
    return rows.reduce((accumulator, row) => {
      Object.values(row.comparison?.checks || {}).forEach((check) => { accumulator[check.status] += 1; });
      [row.statComparison, row.critComparison].forEach((check) => { accumulator[check.status] += 1; });
      return accumulator;
    }, { ok: 0, bad: 0, unknown: 0 });
  }

  function getUnmappedSets(rows) {
    const sets = [];
    for (const row of rows) {
      for (const group of [...row.build.relicSets, ...row.build.ornamentSets]) {
        if (!group.known && group.dataAliases.length === 0 && !sets.some((set) => set.key === group.key)) {
          sets.push(group);
        }
      }
    }
    return sets;
  }

  function renderInlineIcon(url, style = app.styles.inlineStatIcon) {
    if (app.state.simpleMode) return "";
    return url ? `<img src="${escapeHtml(url)}" alt="" style="${style}">` : "";
  }

  function getPropertyIconUrl(propertyName) {
    const normalized = normalizeCompareText(propertyName);
    if (normalized === "hp") return app.config.hpIconUrl;
    if (normalized.includes("공격력")) return app.config.atkIconUrl;
    if (normalized.includes("방어력")) return app.config.defIconUrl;
    if (normalized.includes("속도")) return app.config.spdIconUrl;
    if (normalized.includes("치명타확률")) return app.config.critRateIconUrl;
    if (normalized.includes("치명타피해")) return app.config.critDmgIconUrl;
    if (normalized.includes("격파특수효과")) return app.config.breakIconUrl;
    if (normalized.includes("효과명중")) return app.config.ehrIconUrl;
    if (normalized.includes("에너지회복효율")) return app.config.errIconUrl;
    if (normalized.includes("치유량")) return app.config.healIconUrl;
    return "";
  }

  function renderDisplayStats(properties) {
    const stats = [
      { value: properties.HP, iconUrl: app.config.hpIconUrl },
      { value: properties.공격력, iconUrl: app.config.atkIconUrl },
      { value: properties.방어력, iconUrl: app.config.defIconUrl },
      { value: properties.속도, iconUrl: app.config.spdIconUrl },
      { value: properties["치명타 확률"], iconUrl: app.config.critRateIconUrl },
      { value: properties["치명타 피해"], iconUrl: app.config.critDmgIconUrl },
      { value: properties["격파 특수효과"], iconUrl: app.config.breakIconUrl },
      { value: properties["효과 명중"], iconUrl: app.config.ehrIconUrl },
      { value: properties["에너지 회복효율"], iconUrl: app.config.errIconUrl },
      { value: properties["치유량 보너스"], iconUrl: app.config.healIconUrl },
    ].filter((stat) => stat.value);

    return stats
      .map((stat) => `<span style="white-space:nowrap;">${renderInlineIcon(stat.iconUrl)}${escapeHtml(stat.value)}</span>`)
      .join("<br>");
  }

  function getStatusLabel(status) {
    if (status === "ok") return "적합";
    if (status === "bad") return "확인";
    return "?";
  }

  function getStatusColor(status) {
    if (status === "ok") return "#64d68a";
    if (status === "bad") return "#ff7c7c";
    return "#d4b05f";
  }

  function renderBadge(check) {
    return [
      `<span style="display:inline-block;min-width:34px;color:${getStatusColor(check?.status)};font-weight:700;flex:none;">`,
      getStatusLabel(check?.status),
      "</span>",
    ].join("");
  }

  function renderExpectedText(values) {
    const value = (values || []).filter(Boolean).join(" / ");
    return value ? `<small style="display:block;margin-left:40px;color:#aab4c3;">(${escapeHtml(value)})</small>` : "";
  }

  function renderOptionLine(label, actual, check, expectedValues, iconUrl = "", iconStyle = app.styles.inlineStatIcon) {
    return [
      "<div>",
      '<div style="display:flex;align-items:center;gap:6px;">',
      renderBadge(check),
      `<span style="display:inline-block;min-width:36px;flex:none;">${escapeHtml(label)}:</span>`,
      renderInlineIcon(iconUrl, iconStyle),
      `<span>${escapeHtml(actual || "-")}</span>`,
      "</div>",
      renderExpectedText(expectedValues),
      "</div>",
    ].join("");
  }

  function renderOptionHtmlLine(label, actualHtml, check, expectedValues) {
    return [
      "<div>",
      '<div style="display:flex;align-items:flex-start;gap:6px;">',
      renderBadge(check),
      `<span style="display:inline-block;min-width:42px;flex:none;">${escapeHtml(label)}:</span>`,
      `<span>${actualHtml || "-"}</span>`,
      "</div>",
      renderExpectedText(expectedValues),
      "</div>",
    ].join("");
  }

  function renderStatCheckLine(check) {
    const operator = check.operator === "max" ? "<=" : ">=";
    const notes = check.notes?.length
      ? `<small style="display:block;margin-left:40px;color:#d4b05f;white-space:nowrap;">${escapeHtml(check.notes.join(" / "))}</small>`
      : "";

    return [
      "<div>",
      '<div style="display:flex;align-items:center;gap:6px;">',
      renderBadge(check),
      `<span style="white-space:nowrap;">${escapeHtml(check.propertyName)}: ${escapeHtml(check.actual ?? "-")}</span>`,
      "</div>",
      `<small style="display:block;margin-left:40px;color:#aab4c3;white-space:nowrap;">${escapeHtml(operator)} ${escapeHtml(check.target)} (${escapeHtml(check.label)})</small>`,
      notes,
      "</div>",
    ].join("");
  }

  function renderStatBlock(comparison, fallbackText) {
    if (comparison?.checks?.length) return comparison.checks.map(renderStatCheckLine).join("");
    return `${renderBadge(comparison)}${escapeHtml(fallbackText || "-")}`;
  }

  function getSheetPageUrl() {
    return app.config.sheetPageUrl || "#";
  }

  function formatEidolon(rank) {
    const value = Number(rank);
    if (value === 0) return "명함";
    if (Number.isFinite(value)) return `${value}돌`;
    return `${rank}돌`;
  }

  function formatSetGroupsHtml(groups) {
    return groups.length
      ? groups.map((group) => `${renderInlineIcon(group.iconUrl, app.styles.itemIcon)}${escapeHtml(group.label)} x${escapeHtml(group.count)}`).join("<br>")
      : "-";
  }

  function renderUnmappedSets(sets) {
    if (!sets.length) return "";
    return `
      <div style="margin-bottom:8px;color:#d4b05f;">
        매핑되지 않은 세트:
        ${sets.map((set) =>
          `${escapeHtml(set.key)} 항목:${escapeHtml(set.itemKey || "")}${set.wikiUrl ? ` <a style="color:#8ab4ff;" href="${escapeHtml(set.wikiUrl)}" target="_blank" rel="noreferrer">위키</a>` : ""}`,
        ).join(" · ")}
      </div>
    `;
  }

  function renderReportRow(row) {
    const selectedComparison = row.comparison || {};
    const variant = selectedComparison.variant || row.variants[0] || {};
    const checks = selectedComparison.checks || {};

    return `
      <tr>
        <td>${renderInlineIcon(row.iconUrl, app.styles.characterIcon)}${escapeHtml(row.name)}</td>
        <td>Lv.${escapeHtml(row.level)}<br>${escapeHtml(formatEidolon(row.rank))}</td>
        <td>${escapeHtml(cleanCell(variant.role))}</td>
        <td>${renderOptionLine("엔진", row.build.lightCone, checks.lightCone, variant.lightCones, row.build.lightConeIcon, app.styles.equipmentIcon)}</td>
        <td>
          ${renderOptionHtmlLine("4세트", formatSetGroupsHtml(row.build.relicSets), checks.relicSets, variant.relicSets)}
          ${renderOptionHtmlLine("2세트", formatSetGroupsHtml(row.build.ornamentSets), checks.ornamentSets, variant.ornamentSets)}
        </td>
        <td>
          ${renderOptionLine("4번", row.build.mainStats.body, checks.body, variant.mainStats?.body)}
          ${renderOptionLine("5번", row.build.mainStats.feet, checks.feet, variant.mainStats?.feet)}
          ${renderOptionLine("6번", row.build.mainStats.sphere, checks.sphere, variant.mainStats?.sphere)}
        </td>
        <td>${renderStatBlock(row.statComparison, variant.statTarget)}</td>
        <td>${renderStatBlock(row.critComparison, variant.critTarget)}</td>
      </tr>
    `;
  }

  function createReportHtml(rows) {
    const unmappedSets = getUnmappedSets(rows);
    const totals = getReportTotals(rows);

    return `
      <div style="${app.styles.modalActions}">
        <label style="${app.styles.simpleModeToggle}" title="이미지와 아이콘 숨기기">
          <input type="checkbox" data-jalkiwotda-simple-mode ${app.state.simpleMode ? "checked" : ""} style="position:absolute;opacity:0;pointer-events:none;">
          <span style="${app.styles.simpleModeToggleText}">Simple</span>
          <span style="${app.styles.simpleModeToggleState};background:${app.state.simpleMode ? "#25324a" : "#242b36"};color:${app.state.simpleMode ? "#8ab4ff" : "#aab4c3"};">${app.state.simpleMode ? "ON" : "OFF"}</span>
        </label>
        <button type="button" data-jalkiwotda-close-report style="${app.styles.closeButton}">닫기</button>
      </div>
      <div style="${app.styles.modalHeader}">
        <div>
          <strong style="display:flex;align-items:center;font-size:20px;line-height:1.25;">이잘키 젠존제 정오표</strong>
          <div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <a href="${escapeHtml(getSheetPageUrl())}" target="_blank" rel="noreferrer" style="color:#8ab4ff;font-weight:700;">이잘키 표 열기</a>
            <span style="color:#ffcf70;font-weight:700;">세팅하기 전에 반드시 표를 다시 확인할것.</span>
          </div>
          <div style="margin-top:6px;">
            매칭 ${rows.filter((row) => row.matched).length}/${rows.length}
            · 적합 ${totals.ok}
            · 확인 ${totals.bad}
            · ? ${totals.unknown}
          </div>
        </div>
      </div>
      <div data-jalkiwotda-report-body style="${app.styles.modalBody}">
        ${renderUnmappedSets(unmappedSets)}
        <table>
          <thead>
            <tr>
              <th>캐릭터</th><th>레벨</th><th>역할</th><th>엔진</th><th>세트</th><th>주 옵션</th><th>스탯 목표</th><th>치명타 목표</th>
            </tr>
          </thead>
          <tbody>${rows.map(renderReportRow).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function styleReportTable(modal) {
    modal.querySelector("table").style.cssText = app.styles.table;
    modal.querySelectorAll("th,td").forEach((cell) => { cell.style.cssText = app.styles.tableCell; });
    modal.querySelectorAll("th:nth-child(1),td:nth-child(1)").forEach((cell) => { cell.style.width = "11%"; });
    modal.querySelectorAll("th:nth-child(2),td:nth-child(2)").forEach((cell) => { cell.style.width = "6%"; });
    modal.querySelectorAll("th:nth-child(3),td:nth-child(3)").forEach((cell) => { cell.style.width = "9%"; cell.style.wordBreak = "break-word"; });
    modal.querySelectorAll("th:nth-child(4),td:nth-child(4)").forEach((cell) => {
      cell.style.width = "13%"; cell.style.whiteSpace = "normal"; cell.style.wordBreak = "keep-all";
    });
    modal.querySelectorAll("th:nth-child(5),td:nth-child(5)").forEach((cell) => {
      cell.style.width = "14%"; cell.style.whiteSpace = "normal"; cell.style.wordBreak = "keep-all";
    });
    modal.querySelectorAll("th:nth-child(6),td:nth-child(6)").forEach((cell) => { cell.style.width = "14%"; });
    modal.querySelectorAll("th:nth-child(7),td:nth-child(7),th:nth-child(8),td:nth-child(8)").forEach((cell) => { cell.style.width = "16%"; });
  }

  function getOrCreateReportModal() {
    let modal = document.getElementById("jalkiwotda-zzz-report-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "jalkiwotda-zzz-report-modal";
      modal.style.cssText = app.styles.modal;
      document.body.appendChild(modal);
    }
    return modal;
  }

  function getReportScrollTop(modal) {
    return modal.querySelector("[data-jalkiwotda-report-body]")?.scrollTop || 0;
  }

  function restoreReportScrollTop(modal, scrollTop) {
    const body = modal.querySelector("[data-jalkiwotda-report-body]");
    if (body) body.scrollTop = scrollTop;
  }

  function renderReportModal(modal, rows, scrollTop = null) {
    modal.innerHTML = createReportHtml(rows);
    styleReportTable(modal);
    if (Number.isFinite(scrollTop)) restoreReportScrollTop(modal, scrollTop);

    modal.onclick = (event) => {
      const close = event.target.closest("[data-jalkiwotda-close-report]");
      if (close) { modal.remove(); return; }

      const simpleMode = event.target.closest("[data-jalkiwotda-simple-mode]");
      if (simpleMode) {
        const scrollTop = getReportScrollTop(modal);
        app.state.simpleMode = Boolean(simpleMode.checked);
        window.localStorage?.setItem("jalkiwotda-zzz-simple-mode", app.state.simpleMode ? "1" : "0");
        renderReportModal(modal, rows, scrollTop);
        return;
      }

      const button = event.target.closest("[data-jalkiwotda-variant-index]");
      if (!button) return;

      const rowIndex = Number(button.dataset.jalkiwotdaRowIndex);
      const variantIndex = Number(button.dataset.jalkiwotdaVariantIndex);
      const row = rows[rowIndex];
      if (!row || !Number.isInteger(variantIndex)) return;

      app.compare.applySelectedVariant(row, variantIndex);
      renderReportModal(modal, rows, getReportScrollTop(modal));
    };
  }

  Object.assign(app.render, { getOrCreateReportModal, renderReportModal });
})();
