(() => {
  const app = window.JALKIWOTDA_GENSHIN;
  if (!app) return;
  const { cleanCell, splitLines } = app.utils;

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') inQuotes = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (char !== "\r") field += char;
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function parseMainStats(row) {
    const mainStats = {
      body: splitLines(row[7]),
      feet: splitLines(row[8]),
      sphere: splitLines(row[9]),
      rope: splitLines(row[10]),
    };

    if (mainStats.sphere.length > 0 && mainStats.rope.length === 0) {
      mainStats.rope = [...mainStats.sphere];
    }

    return mainStats;
  }

  function parseAllInOneGenshinMainStats(row) {
    return {
      body: splitLines(cleanAllInOneGenshinCell(row, 13)),
      feet: splitLines(cleanAllInOneGenshinCell(row, 11)),
      sphere: splitLines(cleanAllInOneGenshinCell(row, 12)),
      rope: [],
    };
  }

  function getSheetLetterTags(...values) {
    const tags = [];
    const pattern = /(?:^|\s)(?:\(([A-Z](?:,[A-Z])*)\)|([A-Z](?:,[A-Z])*)[.)])/gu;

    for (const value of values) {
      const text = cleanCell(value);
      let match;
      while ((match = pattern.exec(text))) {
        const raw = match[1] || match[2] || "";
        raw.split(",").map((tag) => tag.trim()).filter(Boolean).forEach((tag) => {
          if (!tags.includes(tag)) tags.push(tag);
        });
      }
    }

    return tags;
  }

  function getSheetNumberTags(...values) {
    const tags = [];
    const pattern = /(?:^|\s)(\d+)[.)]\s+/gu;

    for (const value of values) {
      const text = cleanCell(value);
      let match;
      while ((match = pattern.exec(text))) {
        const tag = cleanCell(match[1]);
        if (tag && !tags.includes(tag)) tags.push(tag);
      }
    }

    return tags;
  }

  function fillMergedSheetCells(rows) {
    const fillColumns = [4, 5, 6, 7, 8, 9, 10, 13, 14];
    const previous = [];

    return rows.map((row) => {
      const next = [...row];
      next.__sheetRowIndex = row.__sheetRowIndex;
      for (const column of fillColumns) {
        if (cleanCell(next[column])) previous[column] = next[column];
        else if (cleanCell(previous[column])) next[column] = previous[column];
      }
      return next;
    });
  }

  function fillMergedAllInOneGenshinSheetCells(rows) {
    const fillColumns = [2, 3, 6, 7, 11, 12, 13, 14, 17, 18, 19, 20, 21];
    const previous = [];

    return rows.map((row) => {
      const next = [...row];
      next.__sheetRowIndex = row.__sheetRowIndex;
      for (const column of fillColumns) {
        if (cleanCell(next[column])) previous[column] = next[column];
        else if (cleanCell(previous[column])) next[column] = previous[column];
      }
      return next;
    });
  }

  function fillMergedCompactGenshinSheetCells(rows) {
    if (app.state.sheetUsesExplicitMerges) return rows.map((row) => [...row]);

    const fillColumns = [1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 18, 19, 20, 21, 22];
    const previous = [];

    return rows.map((row) => {
      const next = [...row];
      next.__sheetRowIndex = row.__sheetRowIndex;
      for (const column of fillColumns) {
        if (cleanCell(next[column])) previous[column] = next[column];
        else if (cleanCell(previous[column])) next[column] = previous[column];
      }
      return next;
    });
  }

  function normalizeGenshinCharacterName(value) {
    return splitLines(value)
      .filter((line) => !line.startsWith("#"))
      .join(" ");
  }

  function cleanAllInOneGenshinCell(row, column) {
    let value = cleanCell(row[column]);

    if (column === 2 && value.includes("권장")) {
      value = value.match(/\d+렙(?:\/\d+렙)?|X/g)?.at(-1) || value;
    } else if (column === 3) {
      value = value.replace(/^특성\s*/u, "");
    } else if (column === 7) {
      value = value.replace(/^<아이콘 설명>\s*성유물\s*/u, "");
    } else if (column === 11 && value.includes("권장 옵션 시계")) {
      value = value.split("권장 옵션 시계").pop();
    } else if (column === 12) {
      value = value.replace(/^성배\s*/u, "");
    } else if (column === 13) {
      value = value.replace(/^왕관\s*/u, "");
    } else if (column === 14) {
      value = value.replace(/^부옵션\s*/u, "");
    } else if (column === 17) {
      value = value.replace(/^추천 무기\s*/u, "");
    } else if (column === 18) {
      value = value.replace(/^권장 스탯 치확\/치피\s*/u, "");
    } else if (column === 19 && value.includes("유효 스탯")) {
      value = value.split("유효 스탯").pop();
    } else if (column === 20) {
      value = value.replace(/^원충\s*/u, "");
      if (value === "유효옵 X") value = "";
    } else if (column === 21 && value === "비고") {
      value = "";
    }

    return cleanCell(value);
  }

  function cleanCompactGenshinCell(row, column) {
    return cleanCell(row[column])
      .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁾]+/gu, "")
      .replace(/^\)+\s*/u, "")
      .trim();
  }

  function getCompactStatNumber(value) {
    const text = cleanCell(value);
    if (!text || /(?:^|[\s:])(?:x|X|없음|해당\s*없음|유효옵\s*X)(?:$|[\s:])/u.test(text)) return "";
    return text.match(/\d[\d,]*(?:\.\d+)?%?/u)?.[0] || "";
  }

  function formatCompactStatTarget(row) {
    const attack = cleanCompactGenshinCell(row, 10);
    const energyRecharge = cleanCompactGenshinCell(row, 12);
    const elementalMastery = cleanCompactGenshinCell(row, 14);
    return [
      getCompactStatNumber(attack) ? `공:${getCompactStatNumber(attack)}` : "",
      getCompactStatNumber(energyRecharge) ? `원충:${getCompactStatNumber(energyRecharge)}` : "",
      getCompactStatNumber(elementalMastery) ? `원마:${getCompactStatNumber(elementalMastery)}` : "",
    ].filter(Boolean).join("\n");
  }

  function formatCritPair(rate, damage) {
    return [
      rate ? `치확 ${rate}` : "",
      damage ? `치피 ${damage}` : "",
    ].filter(Boolean).join("\n");
  }

  function parseCompactCritTargets(row) {
    const withCritWeaponRate = getCompactStatNumber(cleanCompactGenshinCell(row, 15));
    const withCritWeaponDamage = getCompactStatNumber(cleanCompactGenshinCell(row, 16));
    const withoutCritWeaponRate = getCompactStatNumber(cleanCompactGenshinCell(row, 17));
    const withoutCritWeaponDamage = getCompactStatNumber(cleanCompactGenshinCell(row, 18));

    return {
      critDamageWeapon: formatCritPair(withCritWeaponRate, withCritWeaponDamage),
      critRateWeapon: formatCritPair(withoutCritWeaponRate, withoutCritWeaponDamage),
      withCritWeapon: formatCritPair(withCritWeaponRate, withCritWeaponDamage),
      withoutCritWeapon: formatCritPair(withoutCritWeaponRate, withoutCritWeaponDamage),
    };
  }

  function formatCompactCritTarget(row) {
    const targets = parseCompactCritTargets(row);
    return targets.withoutCritWeapon || targets.withCritWeapon || "";
  }

  function mergeUniqueLines(...values) {
    return Array.from(new Set(values.flatMap((value) => splitLines(value)))).join("\n");
  }

  function getCompactVariantKey(variant) {
    return JSON.stringify({
      role: variant.role,
      lightCones: variant.lightCones,
      relicSets: variant.relicSets,
      mainStats: variant.mainStats,
    });
  }

  function mergeCompactVariants(variants) {
    const merged = [];

    for (const variant of variants) {
      const previous = merged.at(-1);
      if (!previous || getCompactVariantKey(previous) !== getCompactVariantKey(variant)) {
        merged.push(variant);
        continue;
      }

      previous.statTarget = mergeUniqueLines(previous.statTarget, variant.statTarget);
      previous.critTargets = {
        critDamageWeapon: mergeUniqueLines(previous.critTargets?.critDamageWeapon, variant.critTargets?.critDamageWeapon),
        critRateWeapon: mergeUniqueLines(previous.critTargets?.critRateWeapon, variant.critTargets?.critRateWeapon),
        withCritWeapon: mergeUniqueLines(previous.critTargets?.withCritWeapon, variant.critTargets?.withCritWeapon),
        withoutCritWeapon: mergeUniqueLines(previous.critTargets?.withoutCritWeapon, variant.critTargets?.withoutCritWeapon),
      };
      previous.critTarget = previous.critTargets.withoutCritWeapon || previous.critTargets.withCritWeapon || "";
      previous.notes = mergeUniqueLines(previous.notes, variant.notes);
    }

    return merged;
  }

  function parseCompactGenshinSheetRows(rows) {
    const characters = [];
    let blockRows = [];

    function isNameOnlyRow(row) {
      return cleanCell(row[0]) && !row.some((cell, index) => index > 0 && cleanCell(cell));
    }

    function isDataRow(row) {
      const role = cleanCell(row[3]);
      const weapon = cleanCell(row[4]);
      const relicSet = cleanCell(row[5]);
      return Boolean(role && (weapon || relicSet) && !(role === weapon && weapon === relicSet));
    }

    function flushBlock(name, rowsToFlush) {
      if (!name || rowsToFlush.length === 0) return;

      const seen = new Set();
      const variants = mergeCompactVariants(fillMergedCompactGenshinSheetCells(rowsToFlush)
        .filter((blockRow) => blockRow.some((cell, index) => index > 0 && cleanCell(cell)))
        .map((blockRow) => {
          const critTargets = parseCompactCritTargets(blockRow);
          return {
            path: "",
            traces: cleanCompactGenshinCell(blockRow, 1),
            ascensionStat: cleanCompactGenshinCell(blockRow, 2),
            role: cleanCompactGenshinCell(blockRow, 3),
            lightCones: splitLines(cleanCompactGenshinCell(blockRow, 4)),
            relicSets: splitLines(cleanCompactGenshinCell(blockRow, 5)),
            ornamentSets: [],
            mainStats: {
              body: splitLines(cleanCompactGenshinCell(blockRow, 9)),
              feet: splitLines(cleanCompactGenshinCell(blockRow, 7)),
              sphere: splitLines(cleanCompactGenshinCell(blockRow, 8)),
              rope: [],
            },
            usefulSubstats: [],
            eidolons: cleanCompactGenshinCell(blockRow, 2),
            statTarget: formatCompactStatTarget(blockRow),
            critTargets,
            critTarget: critTargets.withoutCritWeapon || critTargets.withCritWeapon || "",
            notes: [cleanCompactGenshinCell(blockRow, 19), cleanCompactGenshinCell(blockRow, 20), cleanCompactGenshinCell(blockRow, 21), cleanCompactGenshinCell(blockRow, 22)].filter(Boolean).join("\n"),
          };
        })
        .filter((variant) => {
          const key = JSON.stringify(variant);
          if (seen.has(key)) return false;
          seen.add(key);
          return cleanCell(variant.role) || variant.lightCones.length || variant.relicSets.length;
        }));

      characters.push({ name, variants });
    }

    for (const row of rows.slice(1)) {
      if (blockRows.length === 0 && !isDataRow(row) && !cleanCell(row[0])) continue;

      blockRows.push(row);
      const name = cleanCell(row[0]);
      if (!name) continue;

      flushBlock(name, isNameOnlyRow(row) ? blockRows.slice(0, -1) : blockRows);
      blockRows = [];
    }

    return characters.filter((character) => character.variants.length > 0);
  }

  function parseAllInOneGenshinSheetRows(rows, metadata = {}) {
    const characters = [];
    let currentName = "";
    let blockRows = [];

    function flushBlock() {
      if (!currentName || blockRows.length === 0) return;

      const seen = new Set();
      const variants = fillMergedAllInOneGenshinSheetCells(blockRows
        .filter((blockRow) => blockRow.some((cell, index) => index > 1 && cleanCell(cell))))
        .map((blockRow) => ({
          isAllInOneSheet: true,
          allInOneRoleTags: getSheetLetterTags(blockRow[6]),
          allInOneSettingTags: getSheetLetterTags(blockRow[7], blockRow[11], blockRow[12], blockRow[13]),
          allInOneOptionTags: getSheetNumberTags(blockRow[7], blockRow[11], blockRow[12], blockRow[13]),
          allInOneTargetTags: getSheetNumberTags(blockRow[18]),
          allInOneTargetSettingTags: getSheetLetterTags(blockRow[18]),
          allInOneStatTargetTags: getSheetNumberTags(blockRow[19], blockRow[20]),
          allInOneStatTargetSettingTags: getSheetLetterTags(blockRow[19], blockRow[20]),
          path: "",
          traces: cleanAllInOneGenshinCell(blockRow, 3),
          role: cleanAllInOneGenshinCell(blockRow, 6),
          lightCones: splitLines(cleanAllInOneGenshinCell(blockRow, 17)),
          relicSets: splitLines(cleanAllInOneGenshinCell(blockRow, 7)),
          ornamentSets: [],
          mainStats: parseAllInOneGenshinMainStats(blockRow),
          usefulSubstats: splitLines(cleanAllInOneGenshinCell(blockRow, 14)),
          eidolons: "",
          statTarget: [cleanAllInOneGenshinCell(blockRow, 19), cleanAllInOneGenshinCell(blockRow, 20) ? `원충:${cleanAllInOneGenshinCell(blockRow, 20)}` : ""].filter(Boolean).join("\n"),
          critTarget: cleanAllInOneGenshinCell(blockRow, 18),
          critTargetRichText: metadata.richTexts?.[blockRow.__sheetRowIndex]?.[18] || [],
          notes: cleanAllInOneGenshinCell(blockRow, 21),
        }))
        .filter((variant) => {
          const key = JSON.stringify({
            role: variant.role,
            lightCones: variant.lightCones,
            relicSets: variant.relicSets,
            mainStats: variant.mainStats,
            statTarget: variant.statTarget,
            critTarget: variant.critTarget,
            notes: variant.notes,
          });
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      characters.push({ name: currentName, variants });
    }

    for (const row of rows) {
      const name = normalizeGenshinCharacterName(row[1]);
      if (name && name !== currentName) {
        flushBlock();
        currentName = name;
        blockRows = [row];
      } else if (currentName) {
        blockRows.push(row);
      }
    }

    flushBlock();
    return characters.filter((character) => character.variants.length > 0);
  }

  function parseSheetRows(rows, metadata = {}) {
    const headerIndex = rows.findIndex((row) => cleanCell(row[0]) === "캐릭명");
    if (headerIndex >= 0 && cleanCell(rows[headerIndex]?.[4]).includes("추천 무기") && cleanCell(rows[headerIndex]?.[5]).includes("성유물")) {
      return parseCompactGenshinSheetRows(rows.slice(headerIndex));
    }

    const allInOneHeaderIndex = rows.findIndex((row) =>
      cleanCell(row[0]) === "캐릭터" &&
      cleanCell(row[1]) === "캐릭터" &&
      cleanCell(row[16]).includes("추천 무기"));
    if (allInOneHeaderIndex >= 0) return parseAllInOneGenshinSheetRows(rows.slice(allInOneHeaderIndex + 2), metadata);

    if (headerIndex < 0) return parseAllInOneGenshinSheetRows(rows, metadata);

    const characters = [];
    let blockRows = [];

    for (const row of rows.slice(headerIndex + 2)) {
      blockRows.push(row);
      const name = cleanCell(row[0]);
      if (!name) continue;

      const variants = fillMergedSheetCells(blockRows)
        .filter((blockRow) => blockRow.some((cell, index) => index > 0 && cleanCell(cell)))
        .map((blockRow) => ({
          path: cleanCell(blockRow[1]),
          traces: cleanCell(blockRow[2]),
          role: cleanCell(blockRow[3]),
          lightCones: splitLines(blockRow[4]),
          relicSets: splitLines(blockRow[5]),
          ornamentSets: splitLines(blockRow[6]),
          mainStats: parseMainStats(blockRow),
          usefulSubstats: splitLines(blockRow[11]),
          eidolons: cleanCell(blockRow[12]),
          statTarget: cleanCell(blockRow[13]),
          critTarget: cleanCell(blockRow[14]),
          notes: cleanCell(blockRow[15]),
        }));

      characters.push({ name, variants });
      blockRows = [];
    }

    return characters;
  }

  function expandStructuredSheet(sheet) {
    const rows = (sheet?.rows || []).map((row, index) => {
      const next = [...row];
      next.__sheetRowIndex = index;
      return next;
    });

    for (const merge of sheet?.merges || []) {
      const value = rows[merge.startRow]?.[merge.startColumn] ?? "";
      if (!value) continue;

      if (merge.startColumn === 0 && merge.endColumn === 1) {
        rows[merge.startRow] ||= [];
        rows[merge.startRow][merge.startColumn] = "";
        const targetRow = Math.max(merge.startRow, merge.endRow - 1);
        rows[targetRow] ||= [];
        rows[targetRow][merge.startColumn] = value;
        continue;
      }

      for (let row = merge.startRow; row < merge.endRow; row += 1) {
        rows[row] ||= [];
        for (let column = merge.startColumn; column < merge.endColumn; column += 1) {
          rows[row][column] = value;
        }
      }
    }

    return rows;
  }

  function requestSheetFromExtension() {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        reject(new Error("Sheet bridge did not respond. Reload the HoYoLAB page after reloading the extension."));
      }, 7000);

      function handleMessage(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        if (event.data?.type !== "JALKIWOTDA_GENSHIN_SHEET_RESPONSE" || event.data.requestId !== requestId) return;

        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handleMessage);

        if (event.data.ok) {
          console.info(`[jalkiwotda-genshin] sheet source: ${event.data.source || "unknown"}`);
          resolve(event.data.sheet);
        }
        else reject(new Error(event.data.error || "Sheet request failed"));
      }

      window.addEventListener("message", handleMessage);
      window.postMessage({
        type: "JALKIWOTDA_GENSHIN_SHEET_REQUEST",
        requestId,
        sheetVersion: app.state.sheetVersion,
      }, window.location.origin);
    });
  }

  async function loadSheet() {
    try {
      return await requestSheetFromExtension();
    } catch (error) {
      console.warn("[jalkiwotda-genshin] extension sheet bridge failed", error);
      throw error;
    }
  }

  async function loadSheetCharacters() {
    if (app.state.sheetCharactersCache) return app.state.sheetCharactersCache;
    const sheet = await loadSheet();
    if (!sheet || !Array.isArray(sheet.rows)) throw new Error("Sheet loader returned invalid structured data");
    const rows = expandStructuredSheet(sheet);
    app.state.sheetUsesExplicitMerges = true;
    app.state.sheetMetadataCache = {
      title: sheet.title || "",
      sheetId: sheet.sheetId,
      version: sheet.version || app.state.sheetVersion,
      merges: sheet.merges || [],
      formats: sheet.formats || [],
      richTexts: sheet.richTexts || [],
    };
    app.state.sheetRowsCache = rows;
    app.state.sheetCharactersCache = parseSheetRows(rows, app.state.sheetMetadataCache);
    return app.state.sheetCharactersCache;
  }

  function debugCharacterRows(characterName) {
    const rows = app.state.sheetRowsCache || [];
    const endIndex = rows.findIndex((row) => cleanCell(row[0]) === characterName);
    if (endIndex < 0) {
      console.warn("[jalkiwotda-genshin] character sheet rows not found", characterName);
      return [];
    }

    let startIndex = endIndex - 1;
    while (startIndex >= 0 && !cleanCell(rows[startIndex][0])) startIndex -= 1;
    startIndex += 1;

    const result = rows.slice(startIndex, endIndex + 1).map((row, offset) => ({
      rowIndex: startIndex + offset,
      cells: row
        .map((value, column) => ({ column, value: cleanCell(value) }))
        .filter((cell) => cell.value),
    }));
    const headerIndex = rows.findIndex((row) => cleanCell(row[0]) === "캐릭명");
    const columnCount = Math.max(
      ...rows.slice(Math.max(0, headerIndex - 3), headerIndex + 4).map((row) => row.length),
      ...rows.slice(startIndex, endIndex + 1).map((row) => row.length),
    );
    const headers = Array.from({ length: columnCount }, (_, column) => ({
      column,
      values: rows
        .slice(Math.max(0, headerIndex - 3), headerIndex + 4)
        .map((row) => cleanCell(row[column]))
        .filter(Boolean)
        .join(" / "),
    }));
    const matrix = rows.slice(startIndex, endIndex + 1).map((row, offset) => ({
      row: startIndex + offset,
      ...Object.fromEntries(Array.from({ length: columnCount }, (_, column) => [`c${column}`, cleanCell(row[column])])),
    }));
    const metadata = app.state.sheetMetadataCache || {};
    const merges = (metadata.merges || []).filter((merge) =>
      merge.startRow <= endIndex && merge.endRow > startIndex,
    );
    const formats = (metadata.formats || []).slice(startIndex, endIndex + 1);

    console.log(`[jalkiwotda-genshin] ${characterName} raw sheet rows`, result);
    console.log("[jalkiwotda-genshin] sheet headers", headers);
    console.table(headers);
    console.table(result.flatMap((row) => row.cells.map((cell) => ({
      row: row.rowIndex,
      column: cell.column,
      value: cell.value,
    }))));
    console.log(`[jalkiwotda-genshin] ${characterName} raw matrix`, matrix);
    console.table(matrix);
    console.log(`[jalkiwotda-genshin] ${characterName} sheet merges`, merges);
    console.log(`[jalkiwotda-genshin] ${characterName} sheet formats`, formats);
    return { headers, rows: result, matrix, merges, formats };
  }

  Object.assign(app.sheet, { parseCsv, expandStructuredSheet, parseSheetRows, loadSheetCharacters, debugCharacterRows });
})();
