(() => {
  const app = window.JALKIWOTDA_GENSHIN;
  if (!app) return;
  const { cleanCell, escapeHtml, normalizeCompareText } = app.utils;

  function getReportTotals(rows) {
    return rows.reduce((accumulator, row) => {
      const baseComparison = row.hasSeparateWeaponSelection ? row.settingComparison : row.comparison;
      Object.entries(baseComparison?.checks || {}).forEach(([key, check]) => {
        if (key !== "lightCone" || !row.hasSeparateWeaponSelection) accumulator[check.status] += 1;
      });
      if (row.hasSeparateWeaponSelection) accumulator[row.weaponComparison?.checks?.lightCone?.status || "unknown"] += 1;
      [row.statComparison, row.critComparison].forEach((check) => { accumulator[check.status] += 1; });
      return accumulator;
    }, { ok: 0, bad: 0, overcap: 0, under: 0, unknown: 0 });
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
    if (normalized === "hp" || normalized.includes("hp최대") || normalized.includes("체력")) return app.config.hpIconUrl;
    if (normalized.includes("공격력")) return app.config.atkIconUrl;
    if (normalized.includes("방어력")) return app.config.defIconUrl;
    if (normalized.includes("속도")) return app.config.spdIconUrl;
    if (normalized.includes("치명타확률")) return app.config.critRateIconUrl;
    if (normalized.includes("치명타피해")) return app.config.critDmgIconUrl;
    if (normalized.includes("격파특수효과")) return app.config.breakIconUrl;
    if (normalized.includes("효과명중")) return app.config.ehrIconUrl;
    if (normalized.includes("에너지회복효율") || normalized.includes("원소충전효율") || normalized.includes("원소회복효율")) return app.config.errIconUrl;
    if (normalized.includes("치유량") || normalized.includes("치유")) return app.config.healIconUrl;
    return "";
  }

  function getDisplayStat(properties, ...names) {
    return names.map((name) => properties[name]).find(Boolean);
  }

  function renderDisplayStats(properties) {
    const stats = [
      { value: getDisplayStat(properties, "HP", "HP 최대치", "체력", "체력 최대치"), iconUrl: app.config.hpIconUrl },
      { value: properties.공격력, iconUrl: app.config.atkIconUrl },
      { value: properties.방어력, iconUrl: app.config.defIconUrl },
      { value: properties.속도, iconUrl: app.config.spdIconUrl },
      { value: properties["치명타 확률"], iconUrl: app.config.critRateIconUrl },
      { value: properties["치명타 피해"], iconUrl: app.config.critDmgIconUrl },
      { value: properties["원소 마스터리"], iconUrl: "" },
      { value: properties["격파 특수효과"], iconUrl: app.config.breakIconUrl },
      { value: properties["효과 명중"], iconUrl: app.config.ehrIconUrl },
      { value: getDisplayStat(properties, "에너지 회복효율", "원소 충전 효율"), iconUrl: app.config.errIconUrl },
      { value: getDisplayStat(properties, "치유량 보너스", "치유 보너스"), iconUrl: app.config.healIconUrl },
    ].filter((stat) => stat.value);

    return stats
      .map((stat) => `<span style="white-space:nowrap;">${renderInlineIcon(stat.iconUrl)}${escapeHtml(stat.value)}</span>`)
      .join("<br>");
  }

  function getStatusLabel(status) {
    if (status === "ok") return "적합";
    if (status === "bad") return "확인";
    if (status === "overcap") return "초과";
    if (status === "under") return "미달";
    return "?";
  }

  function getStatusColor(status) {
    if (status === "ok") return "#64d68a";
    if (status === "bad") return "#ff7c7c";
    if (status === "overcap") return "#ffb45c";
    if (status === "under") return "#ffd166";
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
    const target = check.target === null || check.target === undefined
      ? '<small style="display:block;margin-left:40px;color:#aab4c3;white-space:nowrap;">기준 없음</small>'
      : `<small style="display:block;margin-left:40px;color:#aab4c3;white-space:nowrap;">${escapeHtml(operator)} ${escapeHtml(check.target)} (${escapeHtml(check.label)})</small>`;
    const notes = check.notes?.length
      ? `<small style="display:block;margin-left:40px;color:#d4b05f;white-space:nowrap;">${escapeHtml(check.notes.join(" / "))}</small>`
      : "";

    return [
      "<div>",
      '<div style="display:flex;align-items:center;gap:6px;">',
      renderBadge(check),
      `<span style="white-space:nowrap;">${escapeHtml(check.propertyName)}: ${escapeHtml(check.actual ?? "-")}</span>`,
      "</div>",
      target,
      notes,
      "</div>",
    ].join("");
  }

  function renderStatBlock(comparison, fallbackText) {
    if (comparison?.checks?.length) return comparison.checks.map(renderStatCheckLine).join("");
    return `${renderBadge(comparison)}${escapeHtml(fallbackText || "-")}`;
  }

  function getWeaponCritTypeLabel(type) {
    if (type === "critDamage") return "치피 무기";
    if (type === "critRate") return "치확 무기";
    return "비치명 무기";
  }

  function renderCritTargetReferences(row, variant) {
    const targets = variant.critTargets || {};
    const withCritWeapon = targets.withCritWeapon || targets.critDamageWeapon || "";
    const withoutCritWeapon = targets.withoutCritWeapon || targets.critRateWeapon || "";
    if (!withCritWeapon && !withoutCritWeapon) return "";

    return `
      <div style="margin-top:6px;padding-top:5px;border-top:1px solid #2b3442;color:#aab4c3;">
        <small style="display:block;"><strong style="color:${row.build.hasCritWeapon ? "#8ab4ff" : "#aab4c3"};">[치명무기 O]</strong> ${escapeHtml(withCritWeapon || "-").replace(/\n/g, " / ")}</small>
        <small style="display:block;"><strong style="color:${!row.build.hasCritWeapon ? "#8ab4ff" : "#aab4c3"};">[치명무기 X]</strong> ${escapeHtml(withoutCritWeapon || "-").replace(/\n/g, " / ")}</small>
      </div>
    `;
  }

  function getSheetPageUrl() {
    const sheetId = "1sjVkeR8s41wW0oTtBHC1at9riOxWqyXPcbJscYI8fdE";
    const gids = {
      jalkiwotda: "1394698652",
      "all-in-one": "1110572553",
    };
    const version = app.state.sheetMetadataCache?.version || app.state.sheetVersion;
    if (gids[version]) return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=${gids[version]}#gid=${gids[version]}`;
    return app.config.sheetPageUrl || "#";
  }

  function getSheetTitle() {
    return cleanCell(app.state.sheetMetadataCache?.title) || "기준표";
  }

  function formatEidolon(rank) {
    if (!cleanCell(rank)) return "-";
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

  function summarizeVariantHint(variant) {
    return [
      cleanCell(variant.relicSets?.[0]),
      variant.isAllInOneSheet ? cleanCell(variant.mainStats?.feet?.[0] || variant.mainStats?.sphere?.[0] || variant.mainStats?.body?.[0]) : cleanCell(variant.lightCones?.[0]),
    ].filter(Boolean)[0] || "";
  }

  function getVariantLabel(variant, index, duplicateRole = false) {
    const label = cleanCell(variant.role);
    if (!label) return "";
    const role = label.replace(/\n+/g, " / ");
    const hint = duplicateRole ? summarizeVariantHint(variant).replace(/\n+/g, " / ") : "";
    return `${index + 1}. ${role}${hint ? ` - ${hint}` : ""}`;
  }

  function getSettingVariantLabel(variant, index) {
    return [
      `${index + 1}.`,
      cleanCell(variant.relicSets?.[0]),
      cleanCell(variant.mainStats?.feet?.[0] || variant.mainStats?.sphere?.[0] || variant.mainStats?.body?.[0]),
    ].filter(Boolean).join(" ").replace(/\n+/g, " / ");
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

  function renderVariantList(row, selectedVariant, renderedRowIndex) {
    if (!row.variants.length) return "";
    const roleCounts = row.variants.reduce((counts, variant) => {
      const role = cleanCell(variant.role);
      if (role) counts.set(role, (counts.get(role) || 0) + 1);
      return counts;
    }, new Map());

    return `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:#aab4c3;font-size:11px;">
        <strong style="color:#d7dee8;">기준 역할</strong>
        ${row.variants.map((variant, index) => {
          if (!cleanCell(variant.role)) return "";
          const selected = variant === selectedVariant;
          const label = getVariantLabel(variant, index, roleCounts.get(cleanCell(variant.role)) > 1);
          return `<button type="button" data-jalkiwotda-row-index="${escapeHtml(renderedRowIndex)}" data-jalkiwotda-variant-index="${escapeHtml(index)}" style="display:inline-block;padding:2px 5px;border:1px solid ${selected ? "#8ab4ff" : "#5f6b7a"};border-radius:4px;color:${selected ? "#fff" : "#aab4c3"};background:${selected ? "#25324a" : "transparent"};white-space:nowrap;font:inherit;cursor:pointer;">${escapeHtml(label)}</button>`;
        }).join("")}
      </div>
    `;
  }

  function renderSettingVariantList(row, selectedSettingVariant, renderedRowIndex) {
    if (!row.hasSeparateWeaponSelection || !row.settingVariants?.length) return "";
    return `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:#aab4c3;font-size:11px;margin-top:5px;">
        <strong style="color:#d7dee8;">기준 세팅</strong>
        ${row.settingVariants.map((variant, index) => {
          const label = getSettingVariantLabel(variant, index);
          if (!cleanCell(label)) return "";
          const selected = variant === selectedSettingVariant;
          return `<button type="button" data-jalkiwotda-row-index="${escapeHtml(renderedRowIndex)}" data-jalkiwotda-setting-variant-index="${escapeHtml(index)}" style="display:inline-block;padding:2px 5px;border:1px solid ${selected ? "#8ab4ff" : "#5f6b7a"};border-radius:4px;color:${selected ? "#fff" : "#aab4c3"};background:${selected ? "#25324a" : "transparent"};white-space:nowrap;font:inherit;cursor:pointer;">${escapeHtml(label)}</button>`;
        }).join("")}
      </div>
    `;
  }

  function renderWeaponVariantList(row, selectedWeaponVariant, renderedRowIndex) {
    if (!row.hasSeparateWeaponSelection) return "";
    const variants = (row.weaponVariants || [])
      .map((variant, index) => ({ variant, index, label: cleanCell(variant.lightCones?.[0]) }))
      .filter((entry) => entry.label);
    if (!variants.length) return "";

    return `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:#aab4c3;font-size:11px;margin-top:5px;">
        <strong style="color:#d7dee8;">기준 무기</strong>
        ${variants.map(({ variant, index, label }) => {
          const selected = variant === selectedWeaponVariant;
          return `<button type="button" data-jalkiwotda-row-index="${escapeHtml(renderedRowIndex)}" data-jalkiwotda-weapon-variant-index="${escapeHtml(index)}" style="display:inline-block;padding:2px 5px;border:1px solid ${selected ? "#8ab4ff" : "#5f6b7a"};border-radius:4px;color:${selected ? "#fff" : "#aab4c3"};background:${selected ? "#25324a" : "transparent"};white-space:nowrap;font:inherit;cursor:pointer;">${escapeHtml(label.replace(/\n+/g, " / "))}</button>`;
        }).join("")}
      </div>
    `;
  }

  function renderReportRow(row, renderedRowIndex) {
    const roleComparison = row.comparison || {};
    const variant = roleComparison.variant || row.variants[0] || {};
    const selectedComparison = row.hasSeparateWeaponSelection ? row.settingComparison || {} : roleComparison;
    const settingVariant = row.hasSeparateWeaponSelection ? selectedComparison.variant || row.settingVariants?.[0] || variant : variant;
    const effectiveVariant = row.effectiveVariant || settingVariant;
    const weaponVariant = row.weaponVariant || variant;
    const checks = selectedComparison.checks || {};
    const weaponCheck = row.hasSeparateWeaponSelection
      ? row.weaponComparison?.checks?.lightCone
      : checks.lightCone;
    const columnCount = 8;
    const weaponLabel = row.build.lightCone
      ? row.hasSeparateWeaponSelection ? row.build.lightCone : `${row.build.lightCone} [${getWeaponCritTypeLabel(row.build.weaponCritType)}]`
      : "";

    return `
      ${row.variants.length ? `<tr data-jalkiwotda-settings-row><td colspan="${columnCount}">${renderVariantList(row, variant, renderedRowIndex)}${renderSettingVariantList(row, settingVariant, renderedRowIndex)}${renderWeaponVariantList(row, weaponVariant, renderedRowIndex)}</td></tr>` : ""}
      <tr>
        <td>${renderInlineIcon(row.iconUrl, app.styles.characterIcon)}${escapeHtml(row.name)}</td>
        <td>Lv.${escapeHtml(row.level)}<br>${escapeHtml(formatEidolon(row.rank))}</td>
        <td>${escapeHtml(cleanCell(variant.role))}</td>
        <td>${renderOptionLine("무기", weaponLabel, weaponCheck, weaponVariant.lightCones, row.build.lightConeIcon, app.styles.equipmentIcon)}</td>
        <td>
          ${renderOptionHtmlLine("유물", formatSetGroupsHtml(row.build.relicSets), checks.relicSets, settingVariant.relicSets)}
          ${row.build.ornamentSets.length ? renderOptionHtmlLine("장신구", formatSetGroupsHtml(row.build.ornamentSets), checks.ornamentSets, settingVariant.ornamentSets) : ""}
        </td>
        <td>
          ${renderOptionLine("왕관", row.build.mainStats.body, checks.body, settingVariant.mainStats?.body)}
          ${renderOptionLine("시계", row.build.mainStats.feet, checks.feet, settingVariant.mainStats?.feet)}
          ${renderOptionLine("성배", row.build.mainStats.sphere, checks.sphere, settingVariant.mainStats?.sphere)}
        </td>
        <td>${renderStatBlock(row.statComparison, effectiveVariant.statTarget)}</td>
        <td>
          ${renderStatBlock(row.critComparison, row.selectedCritTarget || effectiveVariant.critTarget)}
          ${renderCritTargetReferences(row, effectiveVariant)}
        </td>
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
          <strong style="display:flex;align-items:center;font-size:20px;line-height:1.25;">${escapeHtml(getSheetTitle())}</strong>
          <div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <a href="${escapeHtml(getSheetPageUrl())}" target="_blank" rel="noreferrer" style="color:#8ab4ff;font-weight:700;">${escapeHtml(getSheetTitle())} 보기</a>
            <span style="color:#ffcf70;font-weight:700;">세팅하기 전에 반드시 표를 다시 확인할것.</span>
          </div>
          <div style="margin-top:6px;">
            매칭 ${rows.filter((row) => row.matched).length}/${rows.length}
            · 적합 ${totals.ok}
            · 확인 ${totals.bad}
            · 초과 ${totals.overcap}
            · 미달 ${totals.under}
            · ? ${totals.unknown}
          </div>
        </div>
      </div>
      <div data-jalkiwotda-report-body style="${app.styles.modalBody}">
        ${renderUnmappedSets(unmappedSets)}
        <table>
          <thead>
            <tr>
              <th>캐릭터</th><th>레벨</th><th>역할</th><th>무기</th><th>세트</th><th>주 옵션</th><th>스탯 목표</th><th>치명타 목표</th>
            </tr>
          </thead>
          <tbody>${rows.map((row, index) => renderReportRow(row, index)).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function styleReportTable(modal) {
    modal.querySelector("table").style.cssText = app.styles.table;
    modal.querySelectorAll("th,td").forEach((cell) => { cell.style.cssText = app.styles.tableCell; });
    modal.querySelectorAll("[data-jalkiwotda-settings-row] td").forEach((cell) => {
      cell.style.background = "#151b26";
      cell.style.padding = "5px 6px 8px";
    });
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
    let modal = document.getElementById("jalkiwotda-genshin-report-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "jalkiwotda-genshin-report-modal";
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
        window.localStorage?.setItem("jalkiwotda-genshin-simple-mode", app.state.simpleMode ? "1" : "0");
        renderReportModal(modal, rows, scrollTop);
        return;
      }

      const button = event.target.closest("[data-jalkiwotda-variant-index]");
      const settingButton = event.target.closest("[data-jalkiwotda-setting-variant-index]");
      const weaponButton = event.target.closest("[data-jalkiwotda-weapon-variant-index]");
      if (!button && !settingButton && !weaponButton) return;

      const rowIndex = Number((button || settingButton || weaponButton).dataset.jalkiwotdaRowIndex);
      const variantIndex = Number(button
        ? button.dataset.jalkiwotdaVariantIndex
        : settingButton
          ? settingButton.dataset.jalkiwotdaSettingVariantIndex
          : weaponButton.dataset.jalkiwotdaWeaponVariantIndex);
      const row = rows[rowIndex];
      if (!row || !Number.isInteger(variantIndex)) return;

      if (settingButton) app.compare.applySelectedSettingVariant(row, variantIndex);
      else if (weaponButton) app.compare.applySelectedWeaponVariant(row, variantIndex);
      else app.compare.applySelectedVariant(row, variantIndex);
      renderReportModal(modal, rows, getReportScrollTop(modal));
    };
  }

  Object.assign(app.render, { getOrCreateReportModal, renderReportModal });
})();
