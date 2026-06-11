(() => {
  const app = window.JALKIWOTDA_ZZZ;
  if (!app) return;
  const {
    cleanCell,
    getImageUrl,
    normalizeCompareText,
    normalizeName,
    parseNumber,
  } = app.utils;

  function resolveSheetName(character, sheetByNormalizedName) {
    const normalized = normalizeName(getCharacterName(character));
    const alias = app.constants.aliases.get(normalized);
    if (alias) return alias;
    return sheetByNormalizedName.get(normalized)?.name || null;
  }

  function splitExpectedOptions(values) {
    return values
      .flatMap((value) => cleanCell(value).split(/\n+/))
      .flatMap((value) => value.split(/\s*,\s*/))
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
    return cleanCell(
      property.name ||
      property.property_name ||
      propertyInfo[property.property_type]?.name ||
      propertyInfo[property.id]?.name ||
      String(property.property_type || property.id || ""),
    );
  }

  function getCharacterName(character) {
    return cleanCell(
      character.name ||
      character.name_mi18n ||
      character.full_name ||
      character.full_name_mi18n ||
      character.avatar_name ||
      character.agent_name ||
      "",
    );
  }

  function getPropertyValue(property) {
    return cleanCell(property.final || property.value || property.base || property.add || property.num || "");
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    return Object.values(value);
  }

  function buildProperties(propertyInfo, propertyLists) {
    const properties = {};
    for (const property of propertyLists.flatMap(toArray)) {
      const name = getPropertyName(propertyInfo, property);
      const value = getPropertyValue(property);
      if (name && value) properties[name] = value;
    }
    return properties;
  }

  function getItemName(item) {
    return cleanCell(item?.name || item?.item_name || item?.title || item?.set_name || "");
  }

  function summarizeSets(items) {
    const groups = new Map();
    for (const item of toArray(items)) {
      const label = cleanCell(item?.set?.name || item?.set_name || item?.equip_set?.name || item?.equip_suit?.name || item?.suit?.name || getItemName(item));
      if (!label) continue;
      const group = groups.get(label) || {
        key: label,
        label,
        aliases: [label],
        dataAliases: [label],
        known: true,
        wikiEntryId: null,
        wikiUrl: "",
        itemKey: item?.id || "",
        iconUrl: getImageUrl(item),
        count: 0,
      };
      if (!group.iconUrl) group.iconUrl = getImageUrl(item);
      group.count += 1;
      groups.set(label, group);
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
      const requiredParts = entry.split(/\s*\+\s*|\/+/).map((part) => normalizeCompareText(part)).filter(Boolean);
      if (requiredParts.length === 0) return false;
      return requiredParts.some((part) => actualNames.some((actual) => actual.includes(part) || part.includes(actual)));
    });

    return matched ? { status: "ok", matched } : { status: actualGroups.length ? "bad" : "unknown", matched: null };
  }

  function getDiskPosition(item) {
    return Number(item?.pos || item?.position || item?.slot || item?.equip_pos || item?.equipment_type || item?.index || 0);
  }

  function getMainStatName(item, propertyInfo) {
    return getPropertyName(propertyInfo, item?.main_property || item?.mainProperty || item?.main_stat || item?.mainStat || item?.main_properties?.[0] || item?.mainProperties?.[0] || item?.property);
  }

  function getBuildData(character, propertyInfo) {
    const disks = toArray(character.equip || character.equip_list || character.equipment || character.equipments || character.disks || character.drive_disc || character.drive_discs);
    const itemsByPos = new Map(disks.map((item) => [getDiskPosition(item), item]));
    const engine = character.weapon || character.equip || character.w_engine || character.weapon_info || character.equipment || {};
    const setGroups = summarizeSets(disks);

    return {
      lightCone: getItemName(engine),
      lightConeIcon: getImageUrl(engine),
      relicSets: setGroups.filter((group) => group.count >= 4),
      ornamentSets: setGroups.filter((group) => group.count < 4),
      mainStats: {
        body: getMainStatName(itemsByPos.get(4), propertyInfo),
        feet: getMainStatName(itemsByPos.get(5), propertyInfo),
        sphere: getMainStatName(itemsByPos.get(6), propertyInfo),
        rope: "",
      },
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
    };

    const score = Object.entries(checks).reduce((total, [key, check]) => {
      const weight = app.constants.checkWeights[key] || 1;
      if (check.status === "ok") return total + (2 * weight);
      if (check.status === "bad") return total - weight;
      return total;
    }, 0);

    const matchedSetCount = [checks.relicSets, checks.ornamentSets].filter((check) => check.status === "ok").length;
    const matchedMainStatCount = [checks.body, checks.feet, checks.sphere].filter((check) => check.status === "ok").length;
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
    if (normalized.includes("hp") || normalized.includes("체력")) return "HP";
    if (normalized.includes("공격력") || normalized.startsWith("공")) return "공격력";
    if (normalized.includes("방어")) return "방어력";
    if (normalized.includes("충격")) return "충격력";
    if (normalized.includes("이상마스터리") || normalized.includes("이상마")) return "이상 마스터리";
    if (normalized.includes("이상장악")) return "이상 장악력";
    if (normalized.includes("관통")) return "관통률";
    if (normalized.includes("치명타확률")) return "치명타 확률";
    if (normalized.includes("치명타피해")) return "치명타 피해";
    if (normalized.includes("에너지회복")) return "에너지 자동 회복";
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

  function getCharacters(data) {
    return toArray(data?.avatar_list ||
      data?.agent_list ||
      data?.avatars ||
      data?.agents ||
      data?.list ||
      data?.characters ||
      data?.character_list);
  }

  function getRank(character) {
    return character.rank || character.cinema || character.mindscape_cinema || character.talent_num || 0;
  }

  function buildReportRows(detailData, sheetCharacters) {
    const propertyInfo = detailData.property_info || detailData.property_map || {};
    const sheetByNormalizedName = new Map(sheetCharacters.map((character) => [normalizeName(character.name), character]));

    return getCharacters(detailData).map((character, rowIndex) => {
      const sheetName = resolveSheetName(character, sheetByNormalizedName);
      const sheet = sheetName ? sheetByNormalizedName.get(normalizeName(sheetName)) : null;
      const properties = buildProperties(propertyInfo, [
        character.properties || [],
        character.property_list || [],
        character.stats || [],
        character.stat_list || [],
        character.final_properties || [],
      ]);
      const build = getBuildData(character, propertyInfo);
      const variants = sheet?.variants || [];
      const comparisons = variants.map((variant) => compareVariant(build, variant));
      const comparison = pickBestComparison(build, variants);
      const selectedVariantIndex = Math.max(0, comparisons.findIndex((candidate) => candidate?.variant === comparison?.variant));

      return applySelectedVariant({
        id: character.id || character.avatar_id || character.agent_id || sheetName || rowIndex,
        rowIndex,
        name: getCharacterName(character) || sheetName || "",
        iconUrl: getImageUrl(character),
        level: character.level || character.lv || "",
        rank: getRank(character),
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
