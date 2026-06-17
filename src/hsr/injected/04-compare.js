(() => {
  const app = window.JALKIWOTDA_HSR;
  if (!app) return;
  const {
    addUnique,
    cleanCell,
    getImageUrl,
    normalizeCompareText,
    normalizeName,
    parseNumber,
  } = app.utils;

  function getCharacterName(character) {
    return cleanCell(
      character.name ||
      character.name_mi18n ||
      character.full_name ||
      character.full_name_mi18n ||
      character.avatar_name ||
      "",
    );
  }

  function getSheetCharacterByName(sheetByNormalizedName, name) {
    if (!name) return null;
    return sheetByNormalizedName.get(normalizeName(name)) || null;
  }

  function getUniqueIncludedSheetCharacter(sheetByNormalizedName, normalized) {
    const candidates = Array.from(sheetByNormalizedName.values())
      .filter((character) => {
        const sheetName = normalizeName(character.name);
        return sheetName.length >= 2 && normalized.includes(sheetName);
      });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function resolveSheetName(character, sheetByNormalizedName) {
    const normalized = normalizeName(getCharacterName(character));
    const exactCharacter = sheetByNormalizedName.get(normalized);
    if (exactCharacter) return exactCharacter.name;

    const alias = app.constants.aliases.get(normalized);
    const aliasCharacter = getSheetCharacterByName(sheetByNormalizedName, alias);
    if (aliasCharacter) return aliasCharacter.name;

    const includedCharacter = getUniqueIncludedSheetCharacter(sheetByNormalizedName, normalized);
    if (includedCharacter) return includedCharacter.name;

    if (normalized === "개척자") {
      const suffix = app.constants.pathSuffixByBaseType.get(character.base_type);
      const sheetCharacter = getSheetCharacterByName(sheetByNormalizedName, suffix ? `개척자•${suffix}` : "");
      return sheetCharacter?.name || null;
    }

    if (normalized === "Mar7th") {
      const suffix = app.constants.pathSuffixByBaseType.get(character.base_type);
      const sheetCharacter = getSheetCharacterByName(sheetByNormalizedName, suffix ? `Mar.7•${suffix}` : "");
      return sheetCharacter?.name || null;
    }

    return null;
  }

  function splitExpectedOptions(values) {
    return values
      .flatMap((value) => cleanCell(value).split(/\n+/))
      .flatMap((value) => {
        const normalized = normalizeCompareText(value);
        if (normalized.includes("고민그리고행복")) return [value];
        return value.split(/\s*,\s*/);
      })
      .map((value) => cleanCell(value))
      .filter((value) => value && !value.startsWith("("));
  }

  function compareText(actual, expectedValues) {
    const options = splitExpectedOptions(expectedValues);
    if (options.length === 0) return { status: "unknown", matched: null };

    const actualText = normalizeCompareText(actual);
    if (!actualText) return { status: "unknown", matched: null };

    if (options.some((option) => normalizeCompareText(option) === "아무거나")) {
      return { status: "ok", matched: "아무거나" };
    }

    const matched = options.find((option) => {
      const expectedText = normalizeCompareText(option);
      return expectedText && (actualText.includes(expectedText) || expectedText.includes(actualText));
    });

    return matched ? { status: "ok", matched } : { status: "bad", matched: null };
  }

  function getPropertyName(propertyInfo, property) {
    if (!property) return "";
    return cleanCell(propertyInfo[property.property_type]?.name || String(property.property_type));
  }

  function getWikiEntryId(item, relicWiki) {
    const url = relicWiki?.[item?.id];
    const match = String(url || "").match(/\/entry\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function getSetKey(item, relicWiki) {
    const wikiEntryId = getWikiEntryId(item, relicWiki);
    if (wikiEntryId) return `wiki:${wikiEntryId}`;
    const id = Number(item?.id || 0);
    return id ? `item:${Math.floor(id / 10)}` : "";
  }

  function getSetInfo(item, relicWiki, wikiSetNames) {
    const wikiEntryId = getWikiEntryId(item, relicWiki);
    if (wikiEntryId && wikiSetNames?.has(wikiEntryId)) {
      const label = wikiSetNames.get(wikiEntryId);
      const staticInfo = app.constants.equipmentSetByWikiEntry.get(wikiEntryId);
      return { label, aliases: [label, ...(staticInfo?.aliases || [])] };
    }

    if (wikiEntryId && app.constants.equipmentSetByWikiEntry.has(wikiEntryId)) {
      return app.constants.equipmentSetByWikiEntry.get(wikiEntryId);
    }

    return app.constants.equipmentSetByItemKey.get(Math.floor(Number(item?.id || 0) / 10));
  }

  function getSetAliasFromItemName(item) {
    const name = cleanCell(item?.name || "");
    const possessiveIndex = name.indexOf("의 ");
    return possessiveIndex > 0 ? name.slice(0, possessiveIndex) : name;
  }

  function summarizeSets(items, relicWiki, wikiSetNames) {
    const groups = new Map();

    for (const item of items || []) {
      const key = getSetKey(item, relicWiki);
      if (!key) continue;

      const setInfo = getSetInfo(item, relicWiki, wikiSetNames);
      const wikiEntryId = getWikiEntryId(item, relicWiki);
      const itemKey = Math.floor(Number(item?.id || 0) / 10);
      const dataAlias = getSetAliasFromItemName(item);
      const aliases = setInfo?.aliases ? [...setInfo.aliases] : [];
      addUnique(aliases, dataAlias);

      const group = groups.get(key) || {
        key,
        label: setInfo?.label || dataAlias || `미매핑 ${key}`,
        aliases,
        dataAliases: setInfo ? [] : (dataAlias ? [dataAlias] : []),
        known: Boolean(setInfo),
        wikiEntryId,
        wikiUrl: relicWiki?.[item?.id] || "",
        itemKey,
        iconUrl: getImageUrl(item),
        count: 0,
      };

      addUnique(group.aliases, dataAlias);
      if (!group.iconUrl) group.iconUrl = getImageUrl(item);
      if (!setInfo && dataAlias && !group.dataAliases.includes(dataAlias)) {
        group.dataAliases.push(dataAlias);
        addUnique(group.aliases, dataAlias);
      }

      group.count += 1;
      groups.set(key, group);
    }

    return Array.from(groups.values());
  }

  function compareSetGroups(actualGroups, expectedValues) {
    const expected = splitExpectedOptions(expectedValues);
    if (expected.length === 0) return { status: "unknown", matched: null };

    const actualNames = actualGroups.flatMap((group) =>
      (group.aliases.length ? group.aliases : [group.label]).map((name) => normalizeCompareText(name)),
    );
    const matched = expected.find((entry) => {
      const requiredParts = entry.split(/\s*\+\s*/).map((part) => normalizeCompareText(part)).filter(Boolean);
      if (requiredParts.length === 0) return false;
      return requiredParts.every((part) => actualNames.some((actual) => actual.includes(part) || part.includes(actual)));
    });

    return matched
      ? { status: "ok", matched }
      : {
          status: actualGroups.length === 0 || actualGroups.some((group) => !group.known && group.dataAliases.length === 0)
            ? "unknown"
            : "bad",
          matched: null,
        };
  }

  function getBuildData(character, propertyInfo, relicWiki, wikiSetNames) {
    const relics = character.relics || [];
    const ornaments = character.ornaments || [];
    const itemsByPos = new Map([...relics, ...ornaments].map((item) => [item.pos, item]));
    const mainStats = {
      body: getPropertyName(propertyInfo, itemsByPos.get(3)?.main_property),
      feet: getPropertyName(propertyInfo, itemsByPos.get(4)?.main_property),
      sphere: getPropertyName(propertyInfo, itemsByPos.get(5)?.main_property),
      rope: getPropertyName(propertyInfo, itemsByPos.get(6)?.main_property),
    };

    return {
      lightCone: cleanCell(character.equip?.name || ""),
      lightConeIcon: getImageUrl(character.equip),
      relicSets: summarizeSets(relics, relicWiki, wikiSetNames),
      ornamentSets: summarizeSets(ornaments, relicWiki, wikiSetNames),
      mainStats,
    };
  }

  function compareVariant(build, variant) {
    const checks = {
      lightCone: compareText(build.lightCone, variant.lightCones || []),
      relicSets: compareSetGroups(build.relicSets, variant.relicSets || []),
      ornamentSets: compareSetGroups(build.ornamentSets, variant.ornamentSets || []),
      body: compareText(build.mainStats.body, variant.mainStats?.body || []),
      feet: compareText(build.mainStats.feet, variant.mainStats?.feet || []),
      sphere: compareText(build.mainStats.sphere, variant.mainStats?.sphere || []),
      rope: compareText(build.mainStats.rope, variant.mainStats?.rope || []),
    };

    const score = Object.entries(checks).reduce((total, [key, check]) => {
      const weight = app.constants.checkWeights[key] || 1;
      if (check.status === "ok") return total + (2 * weight);
      if (check.status === "bad") return total - weight;
      return total;
    }, 0);

    const matchedSetCount = [checks.relicSets, checks.ornamentSets].filter((check) => check.status === "ok").length;
    const matchedMainStatCount = [checks.body, checks.feet, checks.sphere, checks.rope].filter((check) => check.status === "ok").length;
    return { variant, checks, score, matchedSetCount, matchedMainStatCount };
  }

  function pickBestComparison(build, variants) {
    return (variants || [])
      .map((variant) => compareVariant(build, variant))
      .sort((left, right) =>
        right.score - left.score ||
        right.matchedSetCount - left.matchedSetCount ||
        right.matchedMainStatCount - left.matchedMainStatCount,
      )[0] || null;
  }

  function getNumericProperty(properties, propertyName) {
    const value = properties[propertyName];
    return value ? parseNumber(value) : null;
  }

  function resolveTargetProperty(line) {
    const normalized = normalizeCompareText(line);
    if (normalized.includes("hp")) return "HP";
    if (normalized.includes("공격력") || /^공\d/.test(normalized) || normalized.startsWith("공")) return "공격력";
    if (normalized.includes("방어")) return "방어력";
    if (normalized.includes("속도")) return "속도";
    if (normalized.includes("치명타확률")) return "치명타 확률";
    if (normalized.includes("치명타피해")) return "치명타 피해";
    if (normalized.includes("효과명중")) return "효과 명중";
    if (normalized.includes("효과저항")) return "효과 저항";
    if (normalized.includes("격파특수효과")) return "격파 특수효과";
    if (normalized.includes("에너지회복효율")) return "에너지 회복효율";
    return null;
  }

  function resolveTargetOperator(line) {
    const text = cleanCell(line);
    if (/[↓<]/.test(text) || /미만|이하|낮/.test(text)) return "max";
    return "min";
  }

  function compareStatValue(actual, target, operator) {
    if (actual === null || target === null) return "unknown";
    return operator === "max" ? (actual <= target ? "ok" : "bad") : (actual >= target ? "ok" : "bad");
  }

  function summarizeCheckStatus(checks) {
    if (checks.length === 0) return "unknown";
    if (checks.some((check) => check.status === "bad")) return "bad";
    if (checks.some((check) => check.status === "unknown")) return "unknown";
    return "ok";
  }

  function compareStatTarget(properties, targetText) {
    const lines = cleanCell(targetText).split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const checks = [];

    for (const line of lines) {
      const propertyName = resolveTargetProperty(line);
      const target = parseNumber(line);
      if (!propertyName || target === null) {
        if (checks.length > 0) {
          const previous = checks[checks.length - 1];
          previous.notes = [...(previous.notes || []), line];
        }
        continue;
      }

      const actual = getNumericProperty(properties, propertyName);
      const operator = resolveTargetOperator(line);
      checks.push({ label: line, propertyName, actual, target, operator, status: compareStatValue(actual, target, operator) });
    }

    return { status: summarizeCheckStatus(checks), checks };
  }

  function compareCritTarget(properties, targetText) {
    const text = cleanCell(targetText);
    if (!text) return { status: "unknown", checks: [] };

    const critRate = getNumericProperty(properties, "치명타 확률");
    const critDamage = getNumericProperty(properties, "치명타 피해");
    const checks = [];
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      const numbers = Array.from(line.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));
      if (numbers.length >= 2 && !resolveTargetProperty(line)) {
        checks.push(
          { label: `치확 ${numbers[0]}`, propertyName: "치명타 확률", actual: critRate, target: numbers[0], operator: "min", status: compareStatValue(critRate, numbers[0], "min") },
          { label: `치피 ${numbers[1]}`, propertyName: "치명타 피해", actual: critDamage, target: numbers[1], operator: "min", status: compareStatValue(critDamage, numbers[1], "min") },
        );
        continue;
      }

      const propertyName = resolveTargetProperty(line);
      const target = numbers[0] ?? null;
      const actual = propertyName === "치명타 확률" ? critRate : propertyName === "치명타 피해" ? critDamage : null;
      if (propertyName && target !== null) {
        const operator = resolveTargetOperator(line);
        checks.push({ label: line, propertyName, actual, target, operator, status: compareStatValue(actual, target, operator) });
      } else if (checks.length > 0) {
        const previous = checks[checks.length - 1];
        previous.notes = [...(previous.notes || []), line];
      }
    }

    return { status: summarizeCheckStatus(checks), checks };
  }

  function applySelectedVariant(row, variantIndex) {
    const fallbackComparison = row.comparisons?.find(Boolean) || row.comparison || null;
    const comparison = row.comparisons?.[variantIndex] || fallbackComparison;
    const variant = comparison?.variant || row.variants?.[variantIndex] || row.variants?.find((candidate) => cleanCell(candidate.role)) || row.variants?.[0] || {};

    row.selectedVariantIndex = Math.max(0, variantIndex);
    row.comparison = comparison;
    row.statComparison = compareStatTarget(row.properties, variant.statTarget || "");
    row.critComparison = compareCritTarget(row.properties, variant.critTarget || "");
    return row;
  }

  function buildReportRows(detailData, sheetCharacters, wikiSetNames = new Map()) {
    const propertyInfo = detailData.property_info || {};
    const relicWiki = detailData.relic_wiki || {};
    const sheetByNormalizedName = new Map(sheetCharacters.map((character) => [normalizeName(character.name), character]));

    return (detailData.avatar_list || []).map((character, rowIndex) => {
      const sheetName = resolveSheetName(character, sheetByNormalizedName);
      const sheet = sheetName ? sheetByNormalizedName.get(normalizeName(sheetName)) : null;
      const properties = Object.fromEntries(
        (character.properties || []).map((property) => [
          cleanCell(propertyInfo[property.property_type]?.name || String(property.property_type)),
          property.final,
        ]),
      );
      const build = getBuildData(character, propertyInfo, relicWiki, wikiSetNames);
      const variants = sheet?.variants || [];
      const comparisons = variants.map((variant) => compareVariant(build, variant));
      const comparison = pickBestComparison(build, variants);
      const selectedVariantIndex = Math.max(0, comparisons.findIndex((candidate) => candidate?.variant === comparison?.variant));

      return applySelectedVariant({
        id: character.id,
        rowIndex,
        name: cleanCell(character.name),
        iconUrl: getImageUrl(character),
        level: character.level,
        rank: character.rank,
        sheetName,
        matched: Boolean(sheet),
        properties,
        build,
        comparisons,
        variants,
      }, selectedVariantIndex);
    });
  }

  Object.assign(app.compare, {
    buildReportRows,
    applySelectedVariant,
  });
})();
