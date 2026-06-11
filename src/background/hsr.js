(() => {
const SHEET_ID = "1kRQjQrHsgIDqPdnyDCVXG59Ge8AaKm0dyJvj6Vp2AY4";
const SHEET_CONFIG = { gid: "0", title: "" };

let sheetCachePromise = null;

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
    ref,
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
    const text = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("");
    strings.push(text);
  }

  return strings;
}

function getCellText(cellXml, type, sharedStrings) {
  if (type === "inlineStr") {
    return Array.from(cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((match) => decodeXml(match[1]))
      .join("");
  }

  const valueMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  if (!valueMatch) return "";

  const value = decodeXml(valueMatch[1]);
  if (type === "s") return sharedStrings[Number(value)] || "";
  return value;
}

function parseSheetXml(xml, sharedStrings) {
  const rows = [];
  const cellPattern = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let cellMatch;

  while ((cellMatch = cellPattern.exec(xml))) {
    const attrs = getAttributes(cellMatch[1] || cellMatch[2] || "");
    const indexes = cellRefToIndexes(attrs.r);
    if (!indexes) continue;

    rows[indexes.row] ||= [];
    rows[indexes.row][indexes.column] = getCellText(cellMatch[0], attrs.t, sharedStrings);
  }

  const merges = [];
  const mergePattern = /<mergeCell\b[^>]*ref="([^"]+)"[^>]*\/?>/g;
  let mergeMatch;

  while ((mergeMatch = mergePattern.exec(xml))) {
    const range = parseRangeRef(decodeXml(mergeMatch[1]));
    if (range) merges.push(range);
  }

  return { rows, merges };
}

async function fetchXlsx() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&id=${SHEET_ID}&gid=${SHEET_CONFIG.gid}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sheet XLSX fetch failed: HTTP ${response.status}`);

  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    const text = new TextDecoder().decode(bytes.slice(0, 512));
    if (/accounts\.google\.com|ServiceLogin|InteractiveLogin/i.test(text)) {
      throw new Error("Sheet XLSX export requires login. Share it as anyone-with-link viewer.");
    }
    throw new Error("Sheet XLSX export did not return an XLSX file");
  }

  return bytes.buffer;
}

async function loadXlsxSheet() {
  const entries = await unzipEntries(await fetchXlsx());
  const workbookXml = readZipText(entries, "xl/workbook.xml");
  const workbookRelsXml = readZipText(entries, "xl/_rels/workbook.xml.rels");
  const sharedStringsXml = entries.has("xl/sharedStrings.xml")
    ? readZipText(entries, "xl/sharedStrings.xml")
    : "";

  const workbookSheets = parseWorkbook(workbookXml, workbookRelsXml);
  const workbookSheet = workbookSheets.find((sheet) => sheet.name === SHEET_CONFIG.title) || workbookSheets[0];
  if (!workbookSheet) throw new Error("XLSX workbook does not contain any sheets");

  const sheetXml = readZipText(entries, workbookSheet.path);
  const parsedSheet = parseSheetXml(sheetXml, parseSharedStrings(sharedStringsXml));

  return {
    title: workbookSheet.name,
    sheetId: workbookSheet.sheetId,
    rows: parsedSheet.rows,
    merges: parsedSheet.merges,
  };
}

async function fetchSheet() {
  if (!sheetCachePromise) sheetCachePromise = loadXlsxSheet();
  return { sheet: await sheetCachePromise, source: "xlsx-export" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "JALKIWOTDA_HSR_FETCH_SHEET") {
    return false;
  }

  fetchSheet()
    .then(({ sheet, source }) => sendResponse({ ok: true, sheet, source }))
    .catch((error) => {
      sheetCachePromise = null;
      sendResponse({ ok: false, error: error?.message || String(error) });
    });

  return true;
});

})();
