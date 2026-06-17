(() => {
  const app = window.JALKIWOTDA_GENSHIN;
  if (!app) return;
  const {
    addUnique,
    cleanCell,
    getImageUrl,
    normalizeCompareText,
    normalizeName,
    parseNumber,
  } = app.utils;

  function getUniqueIncludedSheetCharacter(sheetByNormalizedName, normalized) {
    const candidates = Array.from(sheetByNormalizedName.values())
      .filter((character) => {
        const sheetName = normalizeName(character.name);
        return sheetName.length >= 2 && normalized.includes(sheetName);
      });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function resolveSheetName(character, sheetByNormalizedName) {
    const normalized = normalizeName(character.base?.name || character.name);
    const exactCharacter = sheetByNormalizedName.get(normalized);
    if (exactCharacter) return exactCharacter.name;

    const alias = app.constants.aliases.get(normalized);
    const aliasCharacter = alias ? sheetByNormalizedName.get(normalizeName(alias)) : null;
    if (aliasCharacter) return aliasCharacter.name;

    const includedCharacter = getUniqueIncludedSheetCharacter(sheetByNormalizedName, normalized);
    if (includedCharacter) return includedCharacter.name;

    if (normalized === "여행자") {
      const element = normalizeName(character.base?.element || character.element || character.base?.element_name || character.element_name);
      const elementName = app.constants.travelerElementNames.get(element);
      const candidates = elementName
        ? [`${elementName} 원소 여행자`, `여행자(${elementName})`, `${elementName}행자`, "여행자"]
        : ["여행자"];
      const sheetCharacter = candidates
        .map((name) => sheetByNormalizedName.get(normalizeName(name)))
        .find(Boolean);
      if (sheetCharacter) return sheetCharacter.name;
    }

    return null;
  }

  function getReportCharacterId(character, sheetCharacter) {
    const base = character?.base || character || {};
    return String(base.id || character?.id || base.avatar_id || character?.avatar_id || sheetCharacter?.name || "");
  }

  function splitExpectedOptions(values) {
    return values
      .flatMap((value) => cleanCell(value).split(/\n+/))
      .flatMap((value) => {
        const normalized = normalizeCompareText(value);
        if (normalized.includes("고민그리고행복")) return [value];
        return value.split(/\s*(?:,|\/|또는|or)\s*/i);
      })
      .map((value) => cleanCell(value))
      .filter((value) => value && !value.startsWith("("));
  }

  function compareText(actual, expectedValues, normalizer = normalizeCompareText) {
    const options = splitExpectedOptions(expectedValues);
    if (options.length === 0) return { status: "unknown", matched: null };

    const actualText = normalizer(actual);
    if (!actualText) return { status: "unknown", matched: null };

    if (options.some((option) => normalizeCompareText(option) === "아무거나")) {
      return { status: "ok", matched: "아무거나" };
    }

    const matched = options.find((option) => {
      const expectedText = normalizer(option);
      return expectedText && (actualText.includes(expectedText) || expectedText.includes(actualText));
    });

    return matched ? { status: "ok", matched } : { status: "bad", matched: null };
  }

  function getSheetOptionPrefixMatch(value) {
    return String(value || "").match(/^\s*(?:(?:\([A-Z](?:,[A-Z])*\)|[A-Z](?:,[A-Z])*[.)])\s*|[A-Z](?:,[A-Z])*\s+|\(?\d+\)?[.)]\s*|[가-힣][.)]\s*)/u);
  }

  function getSheetOptionContentStart(value) {
    const match = getSheetOptionPrefixMatch(value);
    return match ? match[0].length : 0;
  }

  function stripSheetOptionPrefix(value) {
    let text = cleanCell(value);
    for (let index = 0; index < 3; index += 1) {
      const start = getSheetOptionContentStart(text);
      if (!start) break;
      text = text.slice(start).trim();
    }
    return text;
  }

  function stripTargetValuePrefix(value) {
    return stripSheetOptionPrefix(value)
      .replace(/(:\s*)\(?[A-Z](?:,[A-Z])*\)?[.)]?\s*/gu, "$1")
      .replace(/(:\s*)\(?\d+\)?[.)](?!\d)\s*/gu, "$1")
      .replace(/(:\s*)[가-힣][.)]\s*/gu, "$1");
  }

  function normalizeMainStatCompareText(value) {
    const normalized = normalizeCompareText(stripSheetOptionPrefix(value)).replace(/%/g, "");
    const compact = normalized.replace(/5$/u, "");

    if (/^(?:hp|hp최대치|체력|체력최대치)$/u.test(compact)) return "hp";
    if (/^(?:공|공퍼|공격|공격력)$/u.test(compact)) return "공격력";
    if (/^(?:방|방퍼|방어|방어력)$/u.test(compact)) return "방어력";
    if (/^(?:원마|원소마스터리)$/u.test(compact)) return "원소마스터리";
    if (/^(?:원충|에충|원소충전효율|원소회복효율|에너지회복효율)$/u.test(compact)) return "원소충전효율";
    if (compact === "치명타확률") return "치명타확률";
    if (compact === "치명타피해") return "치명타피해";
    if (/^(?:치유|치유량)$/u.test(compact)) return "치유보너스";

    if (/^(?:물리피해|물리피증|물피|물리)$/u.test(compact)) return "물리피해";

    const elementAliases = [
      ["불", "불원소피해", "불원피", "불피", "불원피증"],
      ["물", "물원소피해", "물원피", "물피", "물원피증"],
      ["풀", "풀원소피해", "풀원피", "풀피", "풀원피증"],
      ["번개", "번개원소피해", "번개원피", "번원피", "번개피", "번피", "번원피증"],
      ["바람", "바람원소피해", "바람원피", "바람피", "바피", "바람원피증"],
      ["얼음", "얼음원소피해", "얼음원피", "얼원피", "얼음피", "얼피", "얼원피증"],
      ["바위", "바위원소피해", "바위원피", "바위피", "바피", "바위원피증"],
    ];

    for (const [canonical, ...aliases] of elementAliases) {
      if (aliases.some((alias) => compact === alias || compact.includes(alias))) {
        return `${canonical}원소피해`;
      }
    }

    return normalized;
  }

  function normalizeSetCompareText(value) {
    return normalizeCompareText(value).replace(/[24](?:셋)?$/g, "");
  }

  function getSetRequiredCount(value, fallbackCount) {
    const text = cleanCell(value);
    const match = text.match(/([24])\s*(?:셋|세트)?\s*$/u);
    return match ? Number(match[1]) : fallbackCount;
  }

  function expandSetAliases(value) {
    const normalized = normalizeSetCompareText(value);
    const aliases = [normalized];
    const aliasGroups = [
      ["청록", "청록색그림자"],
      ["바람", "마도", "바람이시작되는날"],
      ["마녀", "불타오르는화염의마녀"],
      ["왕실", "옛왕실의의식"],
      ["악단", "대지를유랑하는악단"],
      ["시메", "추억의시메나와"],
      ["천암", "견고한천암"],
      ["감로", "감로빛꽃바다"],
      ["낙원", "잃어버린낙원의꽃"],
      ["도금", "도금된꿈"],
      ["창백", "창백의화염"],
      ["기사도", "피에물든기사도"],
      ["절연", "절연의기치"],
      ["제사", "제사의여운"],
      ["공상", "조화로운공상의단편"],
      ["흑요석", "흑요석비전"],
      ["잿더미", "잿더미성용사의두루마리"],
      ["밤노래", "달을엮는밤노래"],
      ["지난날", "지난날의노래"],
      ["검투사", "검투사의피날레"],
      ["조개", "바다에물든거대조개"],
      ["소녀", "사랑받는소녀"],
      ["반암", "유구한반암"],
      ["번분", "번개같은분노"],
      ["몰락", "몰락한마음"],
      ["얼음", "얼음바람속에서길잃은용사"],
      ["숲기", "숲의기억"],
      ["누각", "모래위누각의역사"],
      ["극단", "황금극단"],
      ["극장", "미완의몽상"],
      ["비경", "밤의속삭임"],
    ];

    for (const group of aliasGroups) {
      if (group.some((alias) => normalized.includes(alias))) {
        group.forEach((alias) => addUnique(aliases, alias));
      }
    }

    if (/원마/.test(normalized)) {
      ["대지를유랑하는악단", "도금된꿈", "잃어버린낙원의꽃", "교관"].forEach((alias) => addUnique(aliases, alias));
    }
    if (/공%?|공격력/.test(normalized)) {
      ["검투사의피날레", "추억의시메나와", "진사왕생록", "제사의여운", "조화로운공상의단편", "미완의몽상"].forEach((alias) => addUnique(aliases, alias));
    }
    if (/체력|hp/.test(normalized)) {
      ["견고한천암", "감로빛꽃바다"].forEach((alias) => addUnique(aliases, alias));
    }
    if (/^(?:방|방어|방어력)$/u.test(normalized)) {
      ["풍요로운꿈의껍데기", "수호자의마음"].forEach((alias) => addUnique(aliases, alias));
    }
    if (/방\d*원|원\d*방/.test(normalized)) {
      ["풍요로운꿈의껍데기", "수호자의마음", "대지를유랑하는악단", "도금된꿈", "잃어버린낙원의꽃", "교관"].forEach((alias) => addUnique(aliases, alias));
    }
    if (/원충|에너지회복효율/.test(normalized)) {
      ["절연의기치", "유배자", "학사", "하늘의은총"].forEach((alias) => addUnique(aliases, alias));
    }

    return aliases.filter(Boolean);
  }

  function splitSetRequirementParts(entry) {
    const plusParts = entry.split(/\s*\+\s*/).filter((part) => cleanCell(part));
    if (plusParts.length !== 1) return plusParts;

    const normalized = normalizeCompareText(plusParts[0]);
    const matches = Array.from(normalized.matchAll(/(방어력|방어|방|원마|원)([24])(?:셋|세트)?/gu));
    if (matches.length < 2) return plusParts;

    let cursor = 0;
    for (const match of matches) {
      if (match.index !== cursor) return plusParts;
      cursor += match[0].length;
    }
    if (cursor !== normalized.length) return plusParts;

    return matches.map((match) => `${match[1] === "원" ? "원마" : match[1]}${match[2]}`);
  }

  function getPropertyName(propertyInfo, property) {
    if (!property) return "";
    const type = property.property_type ?? property.type;
    return cleanCell(propertyInfo[type]?.name || propertyInfo[type]?.filter_name || property.name || property.property_name || property.type_name || String(type || ""));
  }

  function getPropertyValue(property) {
    return [property?.final, property?.value, property?.val, property?.base, property?.add]
      .map((value) => cleanCell(value))
      .find((value) => value !== "") || "";
  }

  function buildProperties(propertyInfo, propertyGroups) {
    const properties = {};

    propertyGroups.flat().forEach((property) => {
      const name = getPropertyName(propertyInfo, property);
      if (!name) return;

      const value = getPropertyValue(property);
      if (!value) return;
      if (!properties[name]) properties[name] = value;
    });

    return properties;
  }

  function getWikiEntryId(item, artifactWiki) {
    const url = artifactWiki?.[item?.id];
    const match = String(url || "").match(/\/entry\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function getNestedValue(source, paths) {
    for (const path of paths) {
      const value = path.reduce((current, key) => current?.[key], source);
      if (cleanCell(value)) return cleanCell(value);
    }
    return "";
  }

  function getSetIdFromItem(item) {
    return getNestedValue(item, [
      ["set_id"],
      ["setId"],
      ["relic_set_id"],
      ["relicSetId"],
      ["reliquary_set_id"],
      ["reliquarySetId"],
      ["equip_set_id"],
      ["equipSetId"],
      ["set", "id"],
      ["relic_set", "id"],
      ["relicSet", "id"],
      ["reliquary_set", "id"],
      ["reliquarySet", "id"],
      ["equip_set", "id"],
      ["equipSet", "id"],
      ["suit", "id"],
    ]);
  }

  function getSetNameFromItem(item) {
    return getNestedValue(item, [
      ["set_name"],
      ["setName"],
      ["relic_set_name"],
      ["relicSetName"],
      ["reliquary_set_name"],
      ["reliquarySetName"],
      ["equip_set_name"],
      ["equipSetName"],
      ["suit_name"],
      ["suitName"],
      ["set", "name"],
      ["relic_set", "name"],
      ["relicSet", "name"],
      ["reliquary_set", "name"],
      ["reliquarySet", "name"],
      ["equip_set", "name"],
      ["equipSet", "name"],
      ["suit", "name"],
    ]);
  }

  function getSetKey(item, artifactWiki) {
    const setId = getSetIdFromItem(item);
    if (setId) return `set:${setId}`;
    const wikiEntryId = getWikiEntryId(item, artifactWiki);
    if (wikiEntryId) return `wiki:${wikiEntryId}`;
    const id = Number(item?.id || 0);
    return id ? `item:${Math.floor(id / 10)}` : "";
  }

  function getSetInfo(item, artifactWiki, wikiSetNames) {
    const wikiEntryId = getWikiEntryId(item, artifactWiki);
    if (wikiEntryId && wikiSetNames?.has(wikiEntryId)) {
      const label = wikiSetNames.get(wikiEntryId);
      const staticInfo = app.constants.equipmentSetByWikiEntry.get(wikiEntryId);
      return { label, aliases: [label, ...(staticInfo?.aliases || [])] };
    }

    if (wikiEntryId && app.constants.equipmentSetByWikiEntry.has(wikiEntryId)) {
      return app.constants.equipmentSetByWikiEntry.get(wikiEntryId);
    }
    return null;
  }

  function getSetAliasFromItemName(item) {
    const setName = getSetNameFromItem(item);
    if (setName) return setName;

    const name = cleanCell(item?.name || "");
    const possessiveIndex = name.indexOf("의 ");
    return possessiveIndex > 0 ? name.slice(0, possessiveIndex) : name;
  }

  function summarizeSets(items, artifactWiki, wikiSetNames) {
    const groups = new Map();

    for (const item of items || []) {
      const key = getSetKey(item, artifactWiki);
      if (!key) continue;

      const setInfo = getSetInfo(item, artifactWiki, wikiSetNames);
      const wikiEntryId = getWikiEntryId(item, artifactWiki);
      const itemKey = Math.floor(Number(item?.id || 0) / 10);
      const dataAlias = getSetAliasFromItemName(item);
      const aliases = setInfo?.aliases ? [...setInfo.aliases] : [];
      addUnique(aliases, dataAlias);
      expandSetAliases(dataAlias).forEach((alias) => addUnique(aliases, alias));

      const group = groups.get(key) || {
        key,
        label: setInfo?.label || dataAlias || `미매핑 ${key}`,
        aliases,
        dataAliases: setInfo ? [] : (dataAlias ? [dataAlias] : []),
        known: Boolean(setInfo),
        wikiEntryId,
        wikiUrl: artifactWiki?.[item?.id] || "",
        itemKey,
        iconUrl: getImageUrl(item),
        count: 0,
      };

      addUnique(group.aliases, dataAlias);
      expandSetAliases(dataAlias).forEach((alias) => addUnique(group.aliases, alias));
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

    const actualEntries = actualGroups.flatMap((group) =>
      (group.aliases.length ? group.aliases : [group.label]).map((name) => ({
        name: normalizeSetCompareText(name),
        count: Number(group.count || 0),
      })),
    );
    const matched = expected.find((entry) => {
      const rawParts = splitSetRequirementParts(entry);
      const requiredParts = rawParts
        .map((part) => ({
          aliases: expandSetAliases(part),
          count: getSetRequiredCount(part, rawParts.length > 1 ? 2 : 4),
        }))
        .filter((part) => part.aliases.length > 0);
      if (requiredParts.length === 0) return false;
      if (requiredParts.length === 1) {
        const required = requiredParts[0];
        return actualEntries.some((actual) =>
          required.aliases.some((alias) => (actual.name.includes(alias) || alias.includes(actual.name)) && actual.count >= required.count),
        );
      }
      return requiredParts.every((required) =>
        actualEntries.some((actual) =>
          required.aliases.some((alias) => (actual.name.includes(alias) || alias.includes(actual.name)) && actual.count >= required.count),
        ),
      );
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

  function getBuildData(character, propertyInfo, artifactWiki, wikiSetNames) {
    const base = character.base || character;
    const artifacts = base.relics || base.reliquaries || base.artifacts || character.relics || character.reliquaries || character.artifacts || [];
    const artifactExtras = character.ornaments || [];
    const itemsByPos = new Map([...artifacts, ...artifactExtras].map((item) => [item.pos || item.position, item]));
    const weapon = character.weapon || character.equip || base.weapon || null;
    const weaponSubStat = getPropertyName(propertyInfo, weapon?.sub_property);
    const normalizedWeaponSubStat = normalizeCompareText(weaponSubStat);
    const weaponCritType = normalizedWeaponSubStat.includes("치명타피해")
      ? "critDamage"
      : normalizedWeaponSubStat.includes("치명타확률")
        ? "critRate"
        : "nonCrit";
    const mainStats = {
      body: getPropertyName(propertyInfo, itemsByPos.get(5)?.main_property),
      feet: getPropertyName(propertyInfo, itemsByPos.get(3)?.main_property),
      sphere: getPropertyName(propertyInfo, itemsByPos.get(4)?.main_property),
      rope: getPropertyName(propertyInfo, itemsByPos.get(6)?.main_property),
    };

    return {
      weapon: cleanCell(weapon?.name || ""),
      weaponIcon: getImageUrl(weapon),
      weaponSubStat,
      weaponCritType,
      hasCritWeapon: weaponCritType !== "nonCrit",
      artifactSets: summarizeSets(artifacts, artifactWiki, wikiSetNames),
      artifactExtraSets: summarizeSets(artifactExtras, artifactWiki, wikiSetNames),
      mainStats,
    };
  }

  function compareVariant(build, variant, options = {}) {
    const checks = {
      weapon: compareText(build.weapon, variant.weapons || []),
      artifactSets: compareSetGroups(build.artifactSets, variant.artifactSets || []),
      artifactExtraSets: compareSetGroups(build.artifactExtraSets, variant.artifactExtraSets || []),
      body: compareText(build.mainStats.body, variant.mainStats?.body || [], normalizeMainStatCompareText),
      feet: compareText(build.mainStats.feet, variant.mainStats?.feet || [], normalizeMainStatCompareText),
      sphere: compareText(build.mainStats.sphere, variant.mainStats?.sphere || [], normalizeMainStatCompareText),
      rope: compareText(build.mainStats.rope, variant.mainStats?.rope || [], normalizeMainStatCompareText),
    };

    const score = Object.entries(checks).reduce((total, [key, check]) => {
      if (key === "weapon" && options.ignoreWeapon) return total;
      const weight = app.constants.checkWeights[key] || 1;
      if (check.status === "ok") return total + (2 * weight);
      if (check.status === "bad") return total - weight;
      return total;
    }, 0);

    const matchedSetCount = [checks.artifactSets, checks.artifactExtraSets].filter((check) => check.status === "ok").length;
    const matchedMainStatCount = [checks.body, checks.feet, checks.sphere, checks.rope].filter((check) => check.status === "ok").length;
    return { variant, checks, score, matchedSetCount, matchedMainStatCount };
  }

  function compareWeaponVariant(build, variant) {
    const weapon = compareText(build.weapon, variant.weapons || []);
    return {
      variant,
      checks: { weapon },
      score: weapon.status === "ok" ? 2 : weapon.status === "bad" ? -1 : 0,
      matchedSetCount: 0,
      matchedMainStatCount: 0,
    };
  }

  function getAllInOneRoleKey(variant) {
    return JSON.stringify({
      role: variant.role,
      roleTags: variant.allInOneRoleTags || [],
    });
  }

  function getAllInOneSettingKey(variant) {
    return JSON.stringify({
      artifactSets: variant.artifactSets,
      artifactExtraSets: variant.artifactExtraSets,
      mainStats: variant.mainStats,
      usefulSubstats: variant.usefulSubstats,
      settingTags: variant.allInOneSettingTags || [],
      optionTags: variant.allInOneOptionTags || [],
    });
  }

  function getAllInOneWeaponKey(variant) {
    return cleanCell(variant.weapons?.[0]);
  }

  function splitAllInOneVariants(variants) {
    const roleVariants = [];
    const roleKeys = new Set();
    const settingVariants = [];
    const settingKeys = new Set();
    const weaponVariants = [];
    const weaponKeys = new Set();

    for (const variant of variants || []) {
      const roleKey = getAllInOneRoleKey(variant);
      if (!roleKeys.has(roleKey)) {
        roleKeys.add(roleKey);
        roleVariants.push({
          ...variant,
          allInOneRoleKey: roleKey,
          weapons: [],
          artifactSets: [],
          artifactExtraSets: [],
          mainStats: { body: [], feet: [], sphere: [], rope: [] },
          usefulSubstats: [],
          statTarget: "",
          critTarget: "",
          notes: "",
        });
      }

      const settingKey = getAllInOneSettingKey(variant);
      if (!settingKeys.has(settingKey)) {
        settingKeys.add(settingKey);
        settingVariants.push({
          ...variant,
          allInOneSettingKey: settingKey,
          role: "",
          weapons: [],
          statTarget: "",
          critTarget: "",
          notes: "",
        });
      }

      const weaponKey = getAllInOneWeaponKey(variant);
      if (weaponKey && !weaponKeys.has(weaponKey)) {
        weaponKeys.add(weaponKey);
        weaponVariants.push({
          ...variant,
          allInOneWeaponKey: weaponKey,
          role: "",
          artifactSets: [],
          artifactExtraSets: [],
          mainStats: { body: [], feet: [], sphere: [], rope: [] },
          usefulSubstats: [],
          statTarget: "",
          critTarget: "",
          notes: "",
        });
      }
    }

    return { roleVariants, settingVariants, weaponVariants };
  }

  function getMatchingTagCount(leftTags = [], rightTags = []) {
    if (!leftTags.length || !rightTags.length) return 0;
    const right = new Set(rightTags.map((tag) => cleanCell(tag)));
    return leftTags.filter((tag) => right.has(cleanCell(tag))).length;
  }

  function resolveAllInOneCombinedVariant(row, roleVariant, settingVariant, weaponVariant) {
    if (!row?.hasSeparateWeaponSelection) return settingVariant || {};

    const roleKey = roleVariant?.allInOneRoleKey || getAllInOneRoleKey(roleVariant || {});
    const settingKey = settingVariant?.allInOneSettingKey || getAllInOneSettingKey(settingVariant || {});
    const weaponKey = weaponVariant?.allInOneWeaponKey || getAllInOneWeaponKey(weaponVariant || {});
    let candidates = (row.sourceVariants || []).filter((variant) =>
      getAllInOneRoleKey(variant) === roleKey &&
      getAllInOneSettingKey(variant) === settingKey &&
      (!weaponKey || getAllInOneWeaponKey(variant) === weaponKey),
    );
    if (candidates.length === 0) {
      candidates = (row.sourceVariants || []).filter((variant) =>
        getAllInOneRoleKey(variant) === roleKey &&
        getAllInOneSettingKey(variant) === settingKey,
      );
    }
    if (candidates.length === 0) {
      candidates = (row.sourceVariants || []).filter((variant) => getAllInOneSettingKey(variant) === settingKey);
    }
    if (candidates.length <= 1) return candidates[0] || settingVariant || {};

    const optionTags = settingVariant?.allInOneOptionTags || [];
    const settingTags = [...(roleVariant?.allInOneRoleTags || []), ...(settingVariant?.allInOneSettingTags || [])];
    return candidates
      .map((variant, index) => ({
        variant,
        index,
        score: (getMatchingTagCount(optionTags, variant.allInOneTargetTags || []) * 2) +
          (getMatchingTagCount(optionTags, variant.allInOneStatTargetTags || []) * 2) +
          getMatchingTagCount(settingTags, variant.allInOneTargetSettingTags || []) +
          getMatchingTagCount(settingTags, variant.allInOneStatTargetSettingTags || []),
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.variant || settingVariant || {};
  }

  function refreshSelectedTargets(row) {
    const roleVariant = row.comparison?.variant || row.variants?.[row.selectedVariantIndex] || row.variants?.[0] || {};
    const settingVariant = row.settingComparison?.variant || row.settingVariants?.[row.selectedSettingVariantIndex] || row.settingVariants?.[0] || roleVariant;
    const weaponVariant = row.weaponVariant || row.weaponComparison?.variant || row.weaponVariants?.[row.selectedWeaponVariantIndex] || row.weaponVariants?.[0] || {};
    const effectiveVariant = resolveAllInOneCombinedVariant(row, roleVariant, settingVariant, weaponVariant);

    row.effectiveVariant = effectiveVariant;
    row.statComparison = compareStatTarget(row.properties, effectiveVariant.statTarget || "");
    row.selectedCritTarget = resolveCritTarget(row.build, effectiveVariant);
    row.critComparison = compareCritTarget(row.properties, row.selectedCritTarget, effectiveVariant.critTargetRichText || []);
    return row;
  }

  function pickBestComparison(build, variants, options = {}) {
    return (variants || [])
      .map((variant) => compareVariant(build, variant, options))
      .sort((left, right) =>
        right.score - left.score ||
        right.matchedSetCount - left.matchedSetCount ||
        right.matchedMainStatCount - left.matchedMainStatCount,
      )[0] || null;
  }

  function pickBestWeaponComparison(build, variants) {
    return (variants || [])
      .map((variant) => compareWeaponVariant(build, variant))
      .sort((left, right) =>
        right.score - left.score ||
        Number(Boolean(cleanCell(right.variant?.weapons?.[0]))) - Number(Boolean(cleanCell(left.variant?.weapons?.[0]))),
      )[0] || null;
  }

  function getNumericProperty(properties, propertyName) {
    const aliases = {
      HP: ["HP 최대치", "체력", "체력 최대치"],
      "HP 최대치": ["HP", "체력", "체력 최대치"],
      체력: ["HP", "HP 최대치", "체력 최대치"],
      방어력: ["방어", "방"],
      방어: ["방어력", "방"],
      "에너지 회복효율": ["원소 충전 효율"],
      "원소 충전 효율": ["에너지 회복효율"],
      "치유량 보너스": ["치유 보너스"],
      "치유 보너스": ["치유량 보너스"],
    };
    const value = [propertyName, ...(aliases[propertyName] || [])]
      .map((name) => properties[name])
      .find(Boolean);
    return value ? parseNumber(value) : null;
  }

  function resolveTargetProperty(line) {
    const normalized = normalizeCompareText(line);
    if (normalized.includes("hp") || normalized.includes("체력")) return "HP";
    if (normalized.includes("공격력") || /^공\d/.test(normalized) || normalized.startsWith("공")) return "공격력";
    if (normalized.includes("방어") || /^방\d/.test(normalized) || normalized.startsWith("방:")) return "방어력";
    if (normalized.includes("속도")) return "속도";
    if (normalized.includes("치명타확률")) return "치명타 확률";
    if (normalized.includes("치명타피해")) return "치명타 피해";
    if (normalized.includes("효과명중")) return "효과 명중";
    if (normalized.includes("효과저항")) return "효과 저항";
    if (normalized.includes("격파특수효과")) return "격파 특수효과";
    if (normalized.includes("에너지회복효율")) return "에너지 회복효율";
    if (normalized.includes("원소충전효율") || normalized.includes("원소회복효율") || normalized.includes("원충")) return "원소 충전 효율";
    if (normalized.includes("원소마스터리") || normalized.includes("원마")) return "원소 마스터리";
    return null;
  }

  function resolveTargetOperator(line) {
    const text = cleanCell(line);
    if (/[↓<]/.test(text) || /미만|이하|낮/.test(text)) return "max";
    return "min";
  }

  function parseTargetSegments(line) {
    const segments = [];
    const pattern = /(HP|체력|공격력|공|방어력|방|원마|원소\s*마스터리|원충|원소\s*충전\s*효율|에너지\s*회복효율|속도|치명타\s*확률|치명타\s*피해)\s*:\s*([^\s]+)/gu;
    let match;

    while ((match = pattern.exec(line))) {
      const propertyName = resolveTargetProperty(match[1]);
      const target = parseNumber(match[2]);
      if (propertyName && target !== null) {
        segments.push({
          label: `${match[1]}:${match[2]}`,
          propertyName,
          target,
        });
      }
    }

    return segments;
  }

  function compareStatValue(actual, target, operator) {
    if (actual === null || target === null) return "unknown";
    return operator === "max" ? (actual <= target ? "ok" : "bad") : (actual >= target ? "ok" : "bad");
  }

  function compareCritRateValue(actual, target, operator) {
    if (actual === null || target === null) return "unknown";
    if (operator === "max") return actual <= target ? "ok" : "overcap";
    return actual >= target ? "ok" : "under";
  }

  function summarizeCheckStatus(checks) {
    if (checks.length === 0) return "unknown";
    if (checks.some((check) => check.status === "bad")) return "bad";
    if (checks.some((check) => check.status === "overcap")) return "overcap";
    if (checks.some((check) => check.status === "under")) return "under";
    if (checks.some((check) => check.status === "unknown")) return "unknown";
    return "ok";
  }

  function compareStatTarget(properties, targetText) {
    const lines = cleanCell(targetText).split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const checks = [];

    for (const line of lines) {
      const compareLine = stripTargetValuePrefix(line);
      const segments = parseTargetSegments(compareLine);
      if (segments.length > 0) {
        const operator = resolveTargetOperator(compareLine);
        segments.forEach((segment) => {
          const actual = getNumericProperty(properties, segment.propertyName);
          checks.push({
            label: segment.label,
            propertyName: segment.propertyName,
            actual,
            target: segment.target,
            operator,
            status: compareStatValue(actual, segment.target, operator),
          });
        });
        continue;
      }

      const propertyName = resolveTargetProperty(compareLine);
      const target = parseNumber(compareLine);
      if (!propertyName || target === null) {
        if (checks.length > 0) {
          const previous = checks[checks.length - 1];
          previous.notes = [...(previous.notes || []), line];
        }
        continue;
      }

      const actual = getNumericProperty(properties, propertyName);
      const operator = resolveTargetOperator(compareLine);
      checks.push({ label: line, propertyName, actual, target, operator, status: compareStatValue(actual, target, operator) });
    }

    return { status: summarizeCheckStatus(checks), checks };
  }

  function getRedCritRateTargetIndexes(richTextRuns) {
    const ranges = [];
    let offset = 0;

    for (const run of richTextRuns || []) {
      const start = offset;
      const end = start + String(run?.text || "").length;
      if (["#d32f2f", "#c00000"].includes(String(run?.foreground || "").toLowerCase())) {
        ranges.push({ start, end });
      }
      offset = end;
    }

    return ranges;
  }

  function isRedCritRateNumber(match, richTextRuns, baseOffset = 0) {
    const redRanges = getRedCritRateTargetIndexes(richTextRuns);
    const start = baseOffset + match.index;
    const end = start + match[0].length;
    return redRanges.some((range) => start >= range.start && end <= range.end);
  }

  function compareCritTarget(properties, targetText, richTextRuns = []) {
    const text = cleanCell(targetText);
    const critRate = getNumericProperty(properties, "치명타 확률");
    const critDamage = getNumericProperty(properties, "치명타 피해");
    const checks = [];
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    let searchOffset = 0;

    for (const line of lines) {
      const lineOffset = text.indexOf(line, searchOffset);
      if (lineOffset >= 0) searchOffset = lineOffset + line.length;
      const contentStart = getSheetOptionContentStart(line);
      const numberMatches = Array.from(line.slice(contentStart).matchAll(/\d+(?:\.\d+)?/g))
        .map((match) => ({ ...match, index: match.index + contentStart }));
      const numbers = numberMatches.map((match) => Number(match[0]));
      if (numbers.length >= 2 && !resolveTargetProperty(line)) {
        const critRateOperator = isRedCritRateNumber(numberMatches[0], richTextRuns, Math.max(0, lineOffset)) ? "max" : "min";
        checks.push(
          { label: `치확 ${numbers[0]}`, propertyName: "치명타 확률", actual: critRate, target: numbers[0], operator: critRateOperator, status: compareCritRateValue(critRate, numbers[0], critRateOperator) },
          { label: `치피 ${numbers[1]}`, propertyName: "치명타 피해", actual: critDamage, target: numbers[1], operator: "min", status: compareStatValue(critDamage, numbers[1], "min") },
        );
        continue;
      }

      const propertyName = resolveTargetProperty(line);
      const target = numbers[0] ?? null;
      const actual = propertyName === "치명타 확률" ? critRate : propertyName === "치명타 피해" ? critDamage : null;
      if (propertyName && target !== null) {
        const operator = resolveTargetOperator(line);
        const status = propertyName === "치명타 확률"
          ? compareCritRateValue(actual, target, operator)
          : compareStatValue(actual, target, operator);
        checks.push({ label: line, propertyName, actual, target, operator, status });
      } else if (checks.length > 0) {
        const previous = checks[checks.length - 1];
        previous.notes = [...(previous.notes || []), line];
      }
    }

    if (!checks.some((check) => check.propertyName === "치명타 확률")) {
      checks.push({
        label: "기준 없음",
        propertyName: "치명타 확률",
        actual: critRate,
        target: null,
        operator: "min",
        status: "unknown",
      });
    }
    if (!checks.some((check) => check.propertyName === "치명타 피해")) {
      checks.push({
        label: "기준 없음",
        propertyName: "치명타 피해",
        actual: critDamage,
        target: null,
        operator: "min",
        status: "unknown",
      });
    }

    return { status: summarizeCheckStatus(checks), checks };
  }

  function resolveCritTarget(build, variant) {
    const targets = variant?.critTargets || null;
    if (!targets) return variant?.critTarget || "";

    if (build?.weaponCritType === "critDamage" || build?.weaponCritType === "critRate") {
      return targets.withCritWeapon || targets.critDamageWeapon || targets.critRateWeapon || targets.withoutCritWeapon || variant?.critTarget || "";
    }
    return targets.withoutCritWeapon || targets.critRateWeapon || targets.withCritWeapon || targets.critDamageWeapon || variant?.critTarget || "";
  }

  function applySelectedWeaponVariant(row, variantIndex) {
    const fallbackComparison = row.weaponComparisons?.find(Boolean) || row.weaponComparison || null;
    const comparison = row.weaponComparisons?.[variantIndex] || fallbackComparison;

    row.selectedWeaponVariantIndex = Math.max(0, variantIndex);
    row.weaponComparison = comparison;
    row.weaponVariant = comparison?.variant || row.weaponVariants?.[variantIndex] || row.weaponVariant || row.weaponVariants?.[0] || {};
    return refreshSelectedTargets(row);
  }

  function applySelectedSettingVariant(row, variantIndex) {
    const fallbackComparison = row.settingComparisons?.find(Boolean) || row.settingComparison || null;
    const comparison = row.settingComparisons?.[variantIndex] || fallbackComparison;

    row.selectedSettingVariantIndex = Math.max(0, variantIndex);
    row.settingComparison = comparison;
    row.settingVariant = comparison?.variant || row.settingVariants?.[variantIndex] || row.settingVariant || row.settingVariants?.[0] || {};
    return refreshSelectedTargets(row);
  }

  function applySelectedVariant(row, variantIndex) {
    const fallbackComparison = row.comparisons?.find(Boolean) || row.comparison || null;
    const comparison = row.comparisons?.[variantIndex] || fallbackComparison;
    const variant = comparison?.variant || row.variants?.[variantIndex] || row.variants?.find((candidate) => cleanCell(candidate.role)) || row.variants?.[0] || {};

    row.selectedVariantIndex = Math.max(0, variantIndex);
    row.comparison = comparison;
    if (row.hasSeparateWeaponSelection && !row.settingComparison) {
      applySelectedSettingVariant(row, row.selectedSettingVariantIndex || 0);
    }
    if (row.hasSeparateWeaponSelection && !row.weaponComparison) {
      applySelectedWeaponVariant(row, row.selectedWeaponVariantIndex || 0);
    }
    return refreshSelectedTargets(row);
  }

  function buildReportRows(detailData, sheetCharacters, wikiSetNames = new Map()) {
    const propertyInfo = detailData.property_info || detailData.property_map || {};
    const artifactWiki = detailData.relic_wiki || {};
    const sheetByNormalizedName = new Map(sheetCharacters.map((character) => [normalizeName(character.name), character]));

    const characters = detailData.jalkiwotda_ordered_characters || detailData.avatar_list || detailData.avatars || detailData.list || detailData.characters || detailData.character_list || (detailData.avatar || detailData.base || detailData.name ? [detailData.avatar || detailData] : []);

    // Keep the HoYoLAB character array order as-is. Do not sort these rows again:
    // id shapes vary between list/detail payloads, and id-based re-sorting can reset the visible order.
    return characters.map((character, rowIndex) => {
      const sheetName = resolveSheetName(character, sheetByNormalizedName);
      if (!sheetName) return null;

      const sheetCharacter = sheetByNormalizedName.get(normalizeName(sheetName));
      if (!sheetCharacter) return null;
      const base = character?.base || character || {};
      const properties = buildProperties(propertyInfo, [
          ...(character?.properties || []),
          ...(character?.selected_properties || []),
          ...(character?.base_properties || []),
          ...(character?.extra_properties || []),
          ...(character?.element_properties || []),
          ...(base.properties || []),
          ...(base.selected_properties || []),
          ...(base.base_properties || []),
          ...(base.extra_properties || []),
          ...(base.element_properties || []),
      ]);
      const build = character
        ? getBuildData(character, propertyInfo, artifactWiki, wikiSetNames)
        : { weapon: "", weaponIcon: "", artifactSets: [], artifactExtraSets: [], mainStats: { body: "", feet: "", sphere: "", rope: "" } };
      const sheetVariants = sheetCharacter.variants || [];
      const hasSeparateWeaponSelection = sheetVariants.some((variant) => variant.isAllInOneSheet);
      const splitVariants = hasSeparateWeaponSelection
        ? splitAllInOneVariants(sheetVariants)
        : { roleVariants: sheetVariants, settingVariants: sheetVariants, weaponVariants: sheetVariants };
      const variants = splitVariants.roleVariants;
      const settingVariants = splitVariants.settingVariants;
      const weaponVariants = splitVariants.weaponVariants;
      const comparisons = hasSeparateWeaponSelection
        ? variants.map((variant) => ({ variant, checks: {}, score: 0, matchedSetCount: 0, matchedMainStatCount: 0 }))
        : variants.map((variant) => compareVariant(build, variant, { ignoreWeapon: hasSeparateWeaponSelection }));
      const settingComparisons = hasSeparateWeaponSelection
        ? settingVariants.map((variant) => compareVariant(build, variant, { ignoreWeapon: true }))
        : [];
      const weaponComparisons = hasSeparateWeaponSelection ? weaponVariants.map((variant) => compareWeaponVariant(build, variant)) : [];
      const comparison = hasSeparateWeaponSelection
        ? comparisons[0] || null
        : pickBestComparison(build, variants, { ignoreWeapon: hasSeparateWeaponSelection });
      const selectedVariantIndex = Math.max(0, comparisons.findIndex((candidate) => candidate?.variant === comparison?.variant));
      const settingComparison = hasSeparateWeaponSelection ? pickBestComparison(build, settingVariants, { ignoreWeapon: true }) : null;
      const selectedSettingVariantIndex = hasSeparateWeaponSelection
        ? Math.max(0, settingComparisons.findIndex((candidate) => candidate?.variant === settingComparison?.variant))
        : selectedVariantIndex;
      const weaponComparison = hasSeparateWeaponSelection ? pickBestWeaponComparison(build, weaponVariants) : null;
      const selectedWeaponVariantIndex = hasSeparateWeaponSelection
        ? Math.max(0, weaponComparisons.findIndex((candidate) => candidate?.variant === weaponComparison?.variant))
        : selectedVariantIndex;

      return applySelectedVariant({
        id: getReportCharacterId(character, sheetCharacter),
        rowIndex,
        name: cleanCell(base.name || character?.name || sheetCharacter.name),
        iconUrl: getImageUrl(base) || getImageUrl(character),
        level: base.level || character?.level || "-",
        rank: base.actived_constellation_num ?? base.constellation_num ?? base.rank ?? character?.rank ?? "",
        sheetName: sheetCharacter.name,
        matched: Boolean(character),
        properties,
        build,
        comparisons,
        settingComparisons,
        settingComparison,
        selectedSettingVariantIndex,
        settingVariant: settingComparison?.variant || null,
        settingVariants,
        weaponComparisons,
        weaponComparison,
        selectedWeaponVariantIndex,
        weaponVariant: weaponComparison?.variant || null,
        weaponVariants,
        sourceVariants: sheetVariants,
        hasSeparateWeaponSelection,
        variants,
      }, selectedVariantIndex);
    }).filter(Boolean);
  }

  Object.assign(app.compare, {
    buildReportRows,
    applySelectedVariant,
    applySelectedSettingVariant,
    applySelectedWeaponVariant,
    debugNormalizeMainStat: normalizeMainStatCompareText,
    debugStripSheetOptionPrefix: stripSheetOptionPrefix,
  });
})();
