(() => {
const SHEET_ID = "1sjVkeR8s41wW0oTtBHC1at9riOxWqyXPcbJscYI8fdE";
const SHEET_CONFIGS = new Map([
  ["all-in-one", { gid: "1110572553", title: "올인원 준종결표" }],
  ["jalkiwotda", { gid: "1394698652", title: "이정도면잘키웠다" }],
]);
const DEFAULT_SHEET_VERSION = "jalkiwotda";

const sheetCachePromises = new Map();

function getSheetConfig(version) {
  const id = SHEET_CONFIGS.has(version) ? version : DEFAULT_SHEET_VERSION;
  return { id, ...SHEET_CONFIGS.get(id) };
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getAttributes(tag) {
  const attributes = {};
  const pattern = /(?:^|\s)([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let match;

  while ((match = pattern.exec(tag))) {
    attributes[match[1]] = decodeXml(match[2]);
  }

  return attributes;
}

function columnNameToIndex(name) {
  let index = 0;
  for (const char of name) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index - 1;
}

function cellRefToIndexes(ref) {
  const match = String(ref || "").match(/^([A-Z]+)(\d+)$/u);
  if (!match) return null;

  return {
    row: Number(match[2]) - 1,
    column: columnNameToIndex(match[1]),
  };
}

function parseRangeRef(ref) {
  const [startRef, endRef = startRef] = String(ref || "").split(":");
  const start = cellRefToIndexes(startRef);
  const end = cellRefToIndexes(endRef);
  if (!start || !end) return null;

  return {
    startRow: start.row,
    endRow: end.row + 1,
    startColumn: start.column,
    endColumn: end.column + 1,
  };
}

function normalizeZipPath(path) {
  const parts = [];
  for (const part of String(path || "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveZipPath(fromPath, target) {
  if (target.startsWith("/")) return normalizeZipPath(target.slice(1));
  const base = fromPath.split("/").slice(0, -1).join("/");
  return normalizeZipPath(`${base}/${target}`);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser does not support XLSX decompression");
  }

  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const entries = new Map();

  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("XLSX central directory was not found");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error("XLSX central directory is invalid");
    }

    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localHeaderOffset = view.getUint32(centralOffset + 42, true);
    const nameStart = centralOffset + 46;
    const nameEnd = nameStart + nameLength;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameEnd));

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error(`XLSX local header is invalid for ${name}`);
    }

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = bytes.slice(dataStart, dataEnd);

    if (method === 0) {
      entries.set(name, compressed);
    } else if (method === 8) {
      entries.set(name, await inflateRaw(compressed));
    } else {
      throw new Error(`Unsupported XLSX compression method: ${method}`);
    }

    centralOffset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function readZipText(entries, path) {
  const entry = entries.get(path);
  if (!entry) throw new Error(`XLSX is missing ${path}`);
  return new TextDecoder("utf-8").decode(entry);
}

function parseRelationships(xml) {
  const relationships = new Map();
  const pattern = /<Relationship\b[^>]*>/g;
  let match;

  while ((match = pattern.exec(xml))) {
    const attrs = getAttributes(match[0]);
    if (attrs.Id && attrs.Target) relationships.set(attrs.Id, attrs.Target);
  }

  return relationships;
}

function parseWorkbook(xml, relsXml) {
  const relationships = parseRelationships(relsXml);
  const sheets = [];
  const pattern = /<sheet\b[^>]*>/g;
  let match;

  while ((match = pattern.exec(xml))) {
    const attrs = getAttributes(match[0]);
    const relationshipId = attrs["r:id"];
    if (!attrs.name || !relationshipId) continue;

    sheets.push({
      name: attrs.name,
      sheetId: attrs.sheetId,
      path: resolveZipPath("xl/workbook.xml", relationships.get(relationshipId) || ""),
    });
  }

  return sheets;
}

function parseSharedStrings(xml) {
  const strings = [];
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;

  while ((match = pattern.exec(xml))) {
    const runs = [];
    const runPattern = /<r\b[^>]*>([\s\S]*?)<\/r>/g;
    let runMatch;

    while ((runMatch = runPattern.exec(match[1]))) {
      const colorMatch = runMatch[1].match(/<color\b[^>]*>/);
      const text = Array.from(runMatch[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
        .map((textMatch) => decodeXml(textMatch[1]))
        .join("");
      if (text) {
        runs.push({
          text,
          foreground: colorMatch ? colorToHex(getAttributes(colorMatch[0])) : "",
        });
      }
    }

    if (runs.length === 0) {
      const text = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
        .map((textMatch) => decodeXml(textMatch[1]))
        .join("");
      if (text) runs.push({ text, foreground: "" });
    }

    strings.push({
      text: runs.map((run) => run.text).join(""),
      runs,
    });
  }

  return strings;
}

function colorToHex(attrs) {
  if (attrs.rgb) return `#${attrs.rgb.slice(-6).toLowerCase()}`;
  if (attrs.theme) return `theme:${attrs.theme}`;
  if (attrs.indexed) return `indexed:${attrs.indexed}`;
  return "";
}

function parseStyles(xml) {
  const numberFormats = new Map([
    [9, "0%"],
    [10, "0.00%"],
  ]);
  const numFmtPattern = /<numFmt\b[^>]*\/?>/g;
  let numFmtMatch;

  while ((numFmtMatch = numFmtPattern.exec(xml))) {
    const attrs = getAttributes(numFmtMatch[0]);
    const id = Number(attrs.numFmtId);
    if (Number.isFinite(id) && attrs.formatCode) {
      numberFormats.set(id, attrs.formatCode);
    }
  }

  const fills = [];
  const fillPattern = /<fill\b[^>]*>([\s\S]*?)<\/fill>/g;
  let fillMatch;

  while ((fillMatch = fillPattern.exec(xml))) {
    const fgMatch = fillMatch[1].match(/<fgColor\b[^>]*>/);
    const bgMatch = fillMatch[1].match(/<bgColor\b[^>]*>/);
    fills.push({
      foreground: fgMatch ? colorToHex(getAttributes(fgMatch[0])) : "",
      background: bgMatch ? colorToHex(getAttributes(bgMatch[0])) : "",
    });
  }

  const fonts = [];
  const fontPattern = /<font\b[^>]*>([\s\S]*?)<\/font>/g;
  let fontMatch;

  while ((fontMatch = fontPattern.exec(xml))) {
    const colorMatch = fontMatch[1].match(/<color\b[^>]*>/);
    fonts.push({
      foreground: colorMatch ? colorToHex(getAttributes(colorMatch[0])) : "",
      bold: /<b\b[^>]*\/?>/.test(fontMatch[1]),
    });
  }

  const styles = [];
  const cellXfsMatch = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  const xfPattern = /<xf\b[^>]*\/?>/g;
  let xfMatch;

  while (cellXfsMatch && (xfMatch = xfPattern.exec(cellXfsMatch[1]))) {
    const attrs = getAttributes(xfMatch[0]);
    const fill = fills[Number(attrs.fillId || 0)] || {};
    const font = fonts[Number(attrs.fontId || 0)] || {};
    const numberFormatId = Number(attrs.numFmtId || 0);
    styles.push({
      background: fill.foreground || fill.background || "",
      foreground: font.foreground || "",
      bold: Boolean(font.bold),
      numberFormat: numberFormats.get(numberFormatId) || "",
    });
  }

  return styles;
}

function formatPercentCellValue(value, numberFormat) {
  if (!String(numberFormat || "").includes("%")) return value;

  const number = Number(value);
  if (!Number.isFinite(number)) return value;

  return `${Number((number * 100).toFixed(10))}%`;
}

function getCellText(cellXml, type, sharedStrings, style = {}) {
  if (type === "inlineStr") {
    return Array.from(cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((match) => decodeXml(match[1]))
      .join("");
  }

  const valueMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  if (!valueMatch) return "";

  const value = decodeXml(valueMatch[1]);
  if (type === "s") return sharedStrings[Number(value)]?.text || "";
  return formatPercentCellValue(value, style.numberFormat);
}

function getCellRichText(cellXml, type, sharedStrings) {
  if (type !== "s") return [];

  const valueMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  if (!valueMatch) return [];

  return (sharedStrings[Number(decodeXml(valueMatch[1]))]?.runs || [])
    .filter((run) => run.text || run.foreground);
}

function parseSheetXml(xml, sharedStrings, styles) {
  const rows = [];
  const formats = [];
  const richTexts = [];
  const cellPattern = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let cellMatch;

  while ((cellMatch = cellPattern.exec(xml))) {
    const attrs = getAttributes(cellMatch[1] || cellMatch[2] || "");
    const indexes = cellRefToIndexes(attrs.r);
    if (!indexes) continue;

    rows[indexes.row] ||= [];
    formats[indexes.row] ||= [];
    const style = styles[Number(attrs.s || 0)] || {
      background: "",
      foreground: "",
      bold: false,
      numberFormat: "",
    };
    rows[indexes.row][indexes.column] = getCellText(cellMatch[0], attrs.t, sharedStrings, style);
    formats[indexes.row][indexes.column] = style;

    if (indexes.column === 18) {
      const runs = getCellRichText(cellMatch[0], attrs.t, sharedStrings);
      if (runs.length > 0) {
        richTexts[indexes.row] ||= [];
        richTexts[indexes.row][indexes.column] = runs;
      }
    }
  }

  const merges = [];
  const mergePattern = /<mergeCell\b[^>]*ref="([^"]+)"[^>]*\/?>/g;
  let mergeMatch;

  while ((mergeMatch = mergePattern.exec(xml))) {
    const range = parseRangeRef(decodeXml(mergeMatch[1]));
    if (range) merges.push(range);
  }

  return { rows, formats, richTexts, merges };
}

async function fetchXlsx(sheetConfig) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&id=${SHEET_ID}&gid=${sheetConfig.gid}`;
  const startedAt = performance.now();
  console.info("[jalkiwotda-genshin] sheet xlsx fetch start", {
    version: sheetConfig.id,
    gid: sheetConfig.gid,
    url,
  });
  const response = await fetch(url);
  console.info("[jalkiwotda-genshin] sheet xlsx fetch response", {
    version: sheetConfig.id,
    status: response.status,
    ok: response.ok,
    elapsedMs: Math.round(performance.now() - startedAt),
  });
  if (!response.ok) throw new Error(`Sheet XLSX fetch failed: HTTP ${response.status}`);

  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  console.info("[jalkiwotda-genshin] sheet xlsx fetch bytes", {
    version: sheetConfig.id,
    byteLength: bytes.byteLength,
    elapsedMs: Math.round(performance.now() - startedAt),
  });
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    const text = new TextDecoder().decode(bytes.slice(0, 512));
    if (/accounts\.google\.com|ServiceLogin|InteractiveLogin/i.test(text)) {
      throw new Error("Sheet XLSX export requires login. Share it as anyone-with-link viewer.");
    }
    throw new Error("Sheet XLSX export did not return an XLSX file");
  }

  return bytes.buffer;
}

async function loadXlsxSheet(sheetConfig) {
  const startedAt = performance.now();
  console.info("[jalkiwotda-genshin] sheet parse start", {
    version: sheetConfig.id,
    gid: sheetConfig.gid,
  });
  const entries = await unzipEntries(await fetchXlsx(sheetConfig));
  console.info("[jalkiwotda-genshin] sheet unzip complete", {
    version: sheetConfig.id,
    entryCount: entries.size,
    elapsedMs: Math.round(performance.now() - startedAt),
  });
  const workbookXml = readZipText(entries, "xl/workbook.xml");
  const workbookRelsXml = readZipText(entries, "xl/_rels/workbook.xml.rels");
  const sharedStringsXml = entries.has("xl/sharedStrings.xml")
    ? readZipText(entries, "xl/sharedStrings.xml")
    : "";
  const stylesXml = entries.has("xl/styles.xml")
    ? readZipText(entries, "xl/styles.xml")
    : "";

  const workbookSheets = parseWorkbook(workbookXml, workbookRelsXml);
  const workbookSheet = workbookSheets.find((sheet) => sheet.name === sheetConfig.title) || workbookSheets[0];
  if (!workbookSheet) throw new Error("XLSX workbook does not contain any sheets");

  const sheetXml = readZipText(entries, workbookSheet.path);
  const parsedSheet = parseSheetXml(sheetXml, parseSharedStrings(sharedStringsXml), parseStyles(stylesXml));
  console.info("[jalkiwotda-genshin] sheet parse complete", {
    version: sheetConfig.id,
    title: workbookSheet.name,
    sheetId: workbookSheet.sheetId,
    rowCount: parsedSheet.rows.length,
    mergeCount: parsedSheet.merges.length,
    elapsedMs: Math.round(performance.now() - startedAt),
  });

  return {
    title: workbookSheet.name,
    sheetId: workbookSheet.sheetId,
    version: sheetConfig.id,
    rows: parsedSheet.rows,
    formats: parsedSheet.formats,
    richTexts: parsedSheet.richTexts,
    merges: parsedSheet.merges,
  };
}

async function fetchSheet(version) {
  const sheetConfig = getSheetConfig(version);
  const cacheHit = sheetCachePromises.has(sheetConfig.id);
  console.info("[jalkiwotda-genshin] sheet request received", {
    requestedVersion: version || "",
    resolvedVersion: sheetConfig.id,
    cacheHit,
  });
  if (!cacheHit) {
    sheetCachePromises.set(sheetConfig.id, loadXlsxSheet(sheetConfig));
  }
  return { sheet: await sheetCachePromises.get(sheetConfig.id), source: `xlsx-export:${sheetConfig.id}` };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "JALKIWOTDA_GENSHIN_FETCH_SHEET") {
    return false;
  }

  fetchSheet(message.sheetVersion)
    .then(({ sheet, source }) => sendResponse({ ok: true, sheet, source }))
    .catch((error) => {
      sheetCachePromises.delete(getSheetConfig(message.sheetVersion).id);
      sendResponse({ ok: false, error: error?.message || String(error) });
    });

  return true;
});

})();
