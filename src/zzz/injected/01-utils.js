(() => {
  const app = window.JALKIWOTDA_ZZZ;
  if (!app) return;

  Object.assign(app.styles, {
    table: "width:100%;table-layout:fixed;border-collapse:collapse;",
    tableCell: "border-bottom:1px solid #2b3442;padding:6px;text-align:left;vertical-align:top;",
    modal: [
      "position:fixed", "inset:0", "z-index:2147483647", "overflow:hidden",
      "background:#10141d", "color:#fff", "font:12px/1.45 sans-serif",
    ].join(";"),
    modalHeader: [
      "position:fixed", "top:0", "left:0", "right:0", "height:86px", "z-index:2",
      "display:flex", "align-items:flex-start", "justify-content:flex-start", "gap:12px",
      "box-sizing:border-box", "padding:14px 178px 10px 16px", "border-bottom:1px solid #2b3442",
      "background:#10141d",
    ].join(";"),
    modalBody: [
      "position:absolute", "top:86px", "left:0", "right:0", "bottom:0", "overflow-x:hidden", "overflow-y:auto",
      "box-sizing:border-box", "padding:10px 12px 12px",
    ].join(";"),
    modalActions: [
      "position:fixed", "top:8px", "right:8px", "z-index:3", "display:flex",
      "align-items:center", "gap:6px",
    ].join(";"),
    closeButton: [
      "border:1px solid #8892a0", "border-radius:4px", "background:#242b36", "color:#fff",
      "padding:4px 8px", "font:12px/1 sans-serif", "cursor:pointer",
    ].join(";"),
    simpleModeToggle: [
      "display:inline-flex", "align-items:center", "gap:0", "overflow:hidden", "flex:none",
      "border:1px solid #5f6b7a", "border-radius:6px", "background:#151b26",
      "color:#aab4c3", "font:12px/1 sans-serif", "cursor:pointer", "user-select:none",
    ].join(";"),
    simpleModeToggleText: [
      "display:inline-block", "padding:6px 8px", "font-weight:700",
    ].join(";"),
    simpleModeToggleState: [
      "display:inline-block", "min-width:34px", "padding:6px 8px", "text-align:center",
      "border-left:1px solid #5f6b7a", "background:#242b36", "color:#fff", "font-weight:700",
    ].join(";"),
    panel: [
      "position:fixed", "right:12px", "bottom:12px", "z-index:2147483647", "display:flex",
      "flex-direction:column", "gap:8px", "align-items:stretch", "width:188px", "padding:8px",
      "border:1px solid #5f6b7a", "border-radius:8px", "background:#151922", "color:#fff",
      "font:12px/1.2 sans-serif", "box-shadow:0 4px 16px rgba(0,0,0,.35)",
    ].join(";"),
    panelButton: [
      "border:1px solid #8892a0", "border-radius:4px", "background:#242b36", "color:#fff",
      "width:100%", "padding:4px 6px", "font:12px/1 sans-serif", "cursor:pointer",
    ].join(";"),
    panelImage: [
      "width:100%", "aspect-ratio:1/1", "object-fit:cover", "border-radius:6px", "background:#242b36", "display:block",
    ].join(";"),
    panelCount: "display:flex;justify-content:space-between;align-items:center;gap:8px;",
    panelButtonRow: "display:flex;",
    reportIcon: "width:24px;height:24px;object-fit:contain;vertical-align:middle;margin-right:8px;",
    statIcon: "width:16px;height:16px;object-fit:contain;vertical-align:-3px;margin-right:4px;",
    inlineStatIcon: "width:16px;height:16px;object-fit:contain;vertical-align:-3px;margin-right:3px;",
    itemIcon: "width:30px;height:30px;object-fit:contain;vertical-align:middle;margin-right:5px;border-radius:4px;background:#242b36;",
    equipmentIcon: "width:60px;height:60px;object-fit:contain;vertical-align:middle;margin-right:5px;border-radius:4px;background:#242b36;",
    characterIcon: "width:60px;height:60px;object-fit:cover;vertical-align:middle;margin-right:6px;border-radius:4px;background:#242b36;",
  });

  function addUnique(list, value) {
    if (value && !list.includes(value)) list.push(value);
  }

  function getUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function isLikelyImageUrl(value) {
    return /^(?:https?:)?\/\//i.test(value) &&
      (/\.(?:png|webp|jpg|jpeg)(?:\?|$)/i.test(value) ||
        value.includes("act-webstatic.hoyoverse.com") ||
        value.includes("act-upload.hoyoverse.com"));
  }

  function normalizeImageUrl(value) {
    return value.startsWith("//") ? `${window.location.protocol}${value}` : value;
  }

  function getImageUrl(source, depth = 0, seen = new Set()) {
    if (!source || depth > 3) return "";
    if (typeof source === "string") return isLikelyImageUrl(source) ? normalizeImageUrl(source) : "";
    if (typeof source !== "object" || seen.has(source)) return "";
    seen.add(source);

    const preferredKeys = [
      "icon", "icon_url", "iconUrl", "image", "image_url", "imageUrl", "item_icon", "itemIcon",
      "avatar_icon", "avatarIcon", "portrait", "portrait_url", "portraitUrl", "head_icon", "headIcon",
      "role_square_url", "group_icon_path", "hollow_icon_path",
    ];

    for (const key of preferredKeys) {
      const url = getImageUrl(source[key], depth + 1, seen);
      if (url) return url;
    }

    for (const [key, value] of Object.entries(source)) {
      if (!/(?:icon|image|avatar|portrait|head|figure|thumb|url)/i.test(key)) continue;
      const url = getImageUrl(value, depth + 1, seen);
      if (url) return url;
    }

    return "";
  }

  function isTarget(url) {
    if (app.constants.targets.some((target) => url.includes(target))) return true;
    try {
      const parsed = new URL(url, window.location.href);
      if (!/\.hoyolab\.com$|\.hoyoverse\.com$|\.mihoyo\.com$/i.test(parsed.hostname)) return false;
      if (!/api|wapi|game_record|record|zzz|nap/i.test(parsed.pathname)) return false;
      return !/upload|log|apm|report|analytics|i18n|translation/i.test(parsed.pathname);
    } catch {
      return /api|wapi|game_record|record|zzz|nap/i.test(String(url || "")) &&
        !/upload|log|apm|report|analytics|i18n|translation/i.test(String(url || ""));
    }
  }

  function parseJson(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function cleanCell(value) {
    return String(value || "").replace(/\u00a0/g, " ").trim();
  }

  function splitLines(value) {
    return cleanCell(value).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  }

  function normalizeName(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, "")
      .replace(/[「」『』]/g, "")
      .replace(/[·.•.]/g, "")
      .trim();
  }

  function normalizeCompareText(value) {
    return cleanCell(value)
      .toLowerCase()
      .replace(/[a-z]\s*\)/gi, "")
      .replace(/\b\d+\s*\)/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/[「」『』]/g, "")
      .replace(/ⅰ/g, "i")
      .replace(/ⅱ/g, "ii")
      .replace(/ⅲ/g, "iii")
      .replace(/ⅳ/g, "iv")
      .replace(/ⅴ/g, "v")
      .replace(/ⅵ/g, "vi")
      .replace(/치확/g, "치명타확률")
      .replace(/치피/g, "치명타피해")
      .replace(/체력/g, "hp")
      .replace(/에너지\s*자동\s*회복/g, "에너지회복")
      .replace(/복을\s*뽐는\s*맹호/g, "복을뿜는맹호")
      .replace(/효명/g, "효과명중")
      .replace(/효저/g, "효과저항")
      .replace(/격특/g, "격파특수효과")
      .replace(/에충/g, "에너지회복효율")
      .replace(/충전/g, "회복")
      .replace(/증가|보너스|속성|세트/g, "")
      .replace(/[,\s·.•.~/+_-]/g, "")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseNumber(value) {
    const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  Object.assign(app.utils, {
    addUnique,
    getUrl,
    getImageUrl,
    isTarget,
    parseJson,
    cleanCell,
    splitLines,
    normalizeName,
    normalizeCompareText,
    escapeHtml,
    parseNumber,
  });
})();
