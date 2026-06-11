(() => {
  const app = window.JALKIWOTDA_ZZZ;
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
    return {
      body: splitLines(row[7]),
      feet: splitLines(row[8]),
      sphere: splitLines(row[9]),
      rope: [],
    };
  }

  function formatEidolonCell(value) {
    const text = cleanCell(value);
    const number = Number(text);
    if (!Number.isFinite(number) || number < 20000 || number > 70000) return text;

    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(number) * 86400000);
    return `${date.getUTCMonth() + 1}, ${date.getUTCDate()}`;
  }

  function fillMergedSheetCells(rows) {
    return rows.map((row) => [...row]);
  }

  function parseSheetRows(rows) {
    const headerIndex = rows.findIndex((row) => cleanCell(row[0]) === "캐릭명");
    if (headerIndex < 0) throw new Error("Could not find sheet header row with 캐릭명");

    const characters = [];
    let blockRows = [];

    function flushBlock(name, rowsToFlush) {
      if (!name || rowsToFlush.length === 0) return;
      const faction = rowsToFlush.map((row) => cleanCell(row[1])).find(Boolean) || "";
      const seen = new Set();
      const variants = fillMergedSheetCells(rowsToFlush)
        .filter((blockRow) => blockRow.some((cell, index) => index > 0 && cleanCell(cell)))
        .map((blockRow) => ({
          path: faction,
          traces: cleanCell(blockRow[3]),
          role: cleanCell(blockRow[2]),
          lightCones: splitLines(blockRow[4]),
          relicSets: splitLines(blockRow[5]),
          ornamentSets: splitLines(blockRow[6]),
          mainStats: parseMainStats(blockRow),
          usefulSubstats: splitLines(blockRow[10]),
          eidolons: formatEidolonCell(blockRow[11]),
          statTarget: cleanCell(blockRow[12]),
          critTarget: cleanCell(blockRow[13]),
          notes: cleanCell(blockRow[14]),
        }))
        .filter((variant) => {
          const key = JSON.stringify({
            role: variant.role,
            traces: variant.traces,
            lightCones: variant.lightCones,
            relicSets: variant.relicSets,
            ornamentSets: variant.ornamentSets,
            mainStats: variant.mainStats,
            usefulSubstats: variant.usefulSubstats,
            eidolons: variant.eidolons,
            statTarget: variant.statTarget,
            critTarget: variant.critTarget,
            notes: variant.notes,
          });
          if (seen.has(key)) return false;
          seen.add(key);
          return variant.lightCones.length ||
            variant.relicSets.length ||
            variant.ornamentSets.length ||
            Object.values(variant.mainStats).some((values) => values.length) ||
            cleanCell(variant.statTarget) ||
            cleanCell(variant.critTarget);
        });

      characters.push({ name, variants });
    }

    for (const row of rows.slice(headerIndex + 2)) {
      blockRows.push(row);
      const name = cleanCell(row[0]);
      if (!name) continue;

      flushBlock(name, blockRows);
      blockRows = [];
    }

    return characters.filter((character) => character.variants.length > 0);
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
        if (event.data?.type !== "JALKIWOTDA_ZZZ_SHEET_RESPONSE" || event.data.requestId !== requestId) return;

        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handleMessage);

        if (event.data.ok) {
          console.info(`[jalkiwotda-zzz] sheet source: ${event.data.source || "unknown"}`);
          resolve(event.data.sheet);
        }
        else reject(new Error(event.data.error || "Sheet request failed"));
      }

      window.addEventListener("message", handleMessage);
      window.postMessage({ type: "JALKIWOTDA_ZZZ_SHEET_REQUEST", requestId }, window.location.origin);
    });
  }

  async function loadSheet() {
    try {
      return await requestSheetFromExtension();
    } catch (error) {
      console.warn("[jalkiwotda-zzz] extension sheet bridge failed", error);
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
      merges: sheet.merges || [],
    };
    app.state.sheetRowsCache = rows;
    app.state.sheetCharactersCache = parseSheetRows(rows);
    return app.state.sheetCharactersCache;
  }

  function debugCharacterRows(characterName) {
    const rows = app.state.sheetRowsCache || [];
    const endIndex = rows.findIndex((row) => cleanCell(row[0]) === characterName);
    if (endIndex < 0) {
      console.warn("[jalkiwotda-zzz] character sheet rows not found", characterName);
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
    const metadata = app.state.sheetMetadataCache || {};
    const merges = (metadata.merges || []).filter((merge) =>
      merge.startRow <= endIndex && merge.endRow > startIndex,
    );

    console.log(`[jalkiwotda-zzz] ${characterName} raw sheet rows`, result);
    console.log(`[jalkiwotda-zzz] ${characterName} sheet merges`, merges);
    return { rows: result, merges };
  }

  Object.assign(app.sheet, { parseCsv, expandStructuredSheet, parseSheetRows, loadSheetCharacters, debugCharacterRows });
})();
