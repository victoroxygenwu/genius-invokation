// Copyright (C) 2024-2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import charactersData from "@gi-tcg/assets-manager/data/CHS/characters";
import actionCardsData from "@gi-tcg/assets-manager/data/CHS/action_cards";
import { getCardName } from "./encounters";
import { pairKey } from "./card-weights";

// ============================================================
// 卡牌关系自动分析
// ============================================================

export interface SuggestedPair {
  a: number;
  b: number;
  weight: number;
  reason: string;
  category: "talent" | "resonance" | "weapon" | "element" | "nation" | "synergy" | "general";
}

// 角色原始数据（从 assets-manager 导入）
interface CharacterRaw {
  id: number;
  name: string;
  tags: string[];
  obtainable: boolean;
}

// 行动牌原始数据
interface ActionCardRaw {
  id: number;
  name: string;
  tags: string[];
  obtainable: boolean;
  relatedCharacterId: number | null;
  relatedCharacterTags: string[];
  description: string;
}

// 标签常量映射
const ELEMENT_TAGS: Record<string, string> = {
  GCG_TAG_ELEMENT_CRYO: "cryo",
  GCG_TAG_ELEMENT_HYDRO: "hydro",
  GCG_TAG_ELEMENT_PYRO: "pyro",
  GCG_TAG_ELEMENT_ELECTRO: "electro",
  GCG_TAG_ELEMENT_ANEMO: "anemo",
  GCG_TAG_ELEMENT_GEO: "geo",
  GCG_TAG_ELEMENT_DENDRO: "dendro",
};

const WEAPON_TAGS: Record<string, string> = {
  GCG_TAG_WEAPON_SWORD: "sword",
  GCG_TAG_WEAPON_CLAYMORE: "claymore",
  GCG_TAG_WEAPON_POLE: "pole",
  GCG_TAG_WEAPON_CATALYST: "catalyst",
  GCG_TAG_WEAPON_BOW: "bow",
};

const ELEMENT_KEYWORDS: Record<string, string[]> = {
  cryo: ["冰元素", "冰伤害"],
  hydro: ["水元素", "水伤害"],
  pyro: ["火元素", "火伤害"],
  electro: ["雷元素", "雷伤害"],
  anemo: ["风元素", "风伤害"],
  geo: ["岩元素", "岩伤害"],
  dendro: ["草元素", "草伤害"],
};

// 预计算 Object.entries，避免循环内重复调用
const WEAPON_TAG_ENTRIES = Object.entries(WEAPON_TAGS);
const ELEMENT_KEYWORD_ENTRIES = Object.entries(ELEMENT_KEYWORDS);

// 角色ID -> 元素/武器/国家 的映射
const charById = new Map<number, CharacterRaw>();
const charsByElement = new Map<string, number[]>();
const charsByWeapon = new Map<string, number[]>();
const charsByNation = new Map<string, number[]>();

function initCharacterMaps(): void {
  if (charById.size > 0) return;
  const chars = (charactersData as unknown as CharacterRaw[]).filter(c => c.obtainable);
  for (const c of chars) {
    charById.set(c.id, c);
    for (const tag of c.tags) {
      const el = ELEMENT_TAGS[tag];
      if (el) {
        if (!charsByElement.has(el)) charsByElement.set(el, []);
        charsByElement.get(el)!.push(c.id);
      }
      const wp = WEAPON_TAGS[tag];
      if (wp) {
        if (!charsByWeapon.has(wp)) charsByWeapon.set(wp, []);
        charsByWeapon.get(wp)!.push(c.id);
      }
      if (tag.startsWith("GCG_TAG_NATION_")) {
        const nation = tag.replace("GCG_TAG_NATION_", "").toLowerCase();
        if (!charsByNation.has(nation)) charsByNation.set(nation, []);
        charsByNation.get(nation)!.push(c.id);
      }
    }
  }
}

/**
 * 获取卡牌的中文名称。
 */
export { getCardName } from "./encounters";

/**
 * 自动分析所有可获得行动牌之间的关联关系。
 * 分三层：
 * 1. 结构化数据（标签、类型、关联角色）→ 天赋/共鸣/武器/元素
 * 2. 描述文本中的卡牌类型关键词 → 同类别卡牌关联
 * 3. 描述文本中的特定卡牌名 → 直接关联
 */
export function analyzeRelationships(): SuggestedPair[] {
  initCharacterMaps();

  const cards = (actionCardsData as unknown as ActionCardRaw[]).filter(c => c.obtainable);
  const pairs: SuggestedPair[] = [];
  const seen = new Set<string>();

  function addPair(a: number, b: number, weight: number, reason: string, category: SuggestedPair["category"]): void {
    const key = pairKey(a, b);
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ a, b, weight, reason, category });
  }

  // ============================================================
  // 第一层：结构化标签分析
  // ============================================================

  for (const card of cards) {
    // 1. 天赋牌 → 绑定角色（最强关联，0.9）
    if (card.tags.includes("GCG_TAG_TALENT") && card.relatedCharacterId) {
      const charId = card.relatedCharacterId;
      if (charById.has(charId)) {
        addPair(card.id, charId, 0.9,
          `天赋牌「${card.name}」专属角色「${getCardName(charId)}」`,
          "talent");
      }
    }

    // 2. 元素共鸣牌 → 同元素角色（0.7）
    if (card.tags.includes("GCG_TAG_RESONANCE")) {
      for (const tag of card.relatedCharacterTags) {
        const el = ELEMENT_TAGS[tag];
        if (el) {
          const charIds = charsByElement.get(el) ?? [];
          for (const charId of charIds) {
            addPair(card.id, charId, 0.7,
              `元素共鸣「${card.name}」需要${el}元素角色`,
              "resonance");
          }
        }
      }
    }

    // 3. 武器牌 → 对应武器类型角色（0.5）
    for (const [tag, weaponType] of WEAPON_TAG_ENTRIES) {
      if (card.tags.includes(tag)) {
        const charIds = charsByWeapon.get(weaponType) ?? [];
        for (const charId of charIds) {
          addPair(card.id, charId, 0.5,
            `武器牌「${card.name}」（${weaponType}）可装备`,
            "weapon");
        }
      }
    }

    // 4. 圣遗物牌 → 描述中提到特定元素的角色（0.3）
    if (card.tags.includes("GCG_TAG_ARTIFACT")) {
      const desc = card.description || "";
      for (const [el, keywords] of ELEMENT_KEYWORD_ENTRIES) {
        if (keywords.some(kw => desc.includes(kw))) {
          const charIds = charsByElement.get(el) ?? [];
          for (const charId of charIds) {
            addPair(card.id, charId, 0.3,
              `圣遗物「${card.name}」效果涉及${el}元素`,
              "element");
          }
        }
      }
    }
  }

  // ============================================================
  // 第二层：描述文本中的卡牌类型关键词分析
  // ============================================================

  // 描述中提到的关键词 → 对应卡牌标签
  // excludeIfSelfTag: 如果源卡本身有目标标签，是否排除（true=排除自引用）
  const KEYWORD_TO_TAGS: Array<{
    keyword: string;
    targetTags: string[];
    weight: number;
    label: string;
    excludeIfSelfTag: boolean;
  }> = [
    { keyword: "「伙伴」", targetTags: ["GCG_TAG_ALLY"], weight: 0.7, label: "伙伴支援牌", excludeIfSelfTag: false },
    { keyword: "「场地」", targetTags: ["GCG_TAG_PLACE"], weight: 0.7, label: "场地支援牌", excludeIfSelfTag: false },
    { keyword: "「圣遗物」", targetTags: ["GCG_TAG_ARTIFACT"], weight: 0.7, label: "圣遗物牌", excludeIfSelfTag: true },
    { keyword: "「武器」", targetTags: ["GCG_TAG_WEAPON"], weight: 0.7, label: "武器牌", excludeIfSelfTag: true },
    { keyword: "「料理」", targetTags: ["GCG_TAG_FOOD"], weight: 0.7, label: "料理牌", excludeIfSelfTag: true },
    { keyword: "「特技」", targetTags: ["GCG_TAG_VEHICLE"], weight: 0.7, label: "特技牌", excludeIfSelfTag: true },
    { keyword: "「道具」", targetTags: ["GCG_TAG_ITEM"], weight: 0.5, label: "道具牌", excludeIfSelfTag: false },
    { keyword: "「装备牌」", targetTags: ["GCG_TAG_WEAPON", "GCG_TAG_ARTIFACT", "GCG_TAG_VEHICLE"], weight: 0.6, label: "装备牌", excludeIfSelfTag: true },
  ];

  // 按标签分组所有可获得行动牌
  const cardsByTag = new Map<string, ActionCardRaw[]>();
  for (const card of cards) {
    for (const tag of card.tags) {
      if (!cardsByTag.has(tag)) cardsByTag.set(tag, []);
      cardsByTag.get(tag)!.push(card);
    }
  }

  for (const card of cards) {
    const desc = card.description || "";
    if (!desc) continue;

    for (const rule of KEYWORD_TO_TAGS) {
      if (!desc.includes(rule.keyword)) continue;

      // 自引用排除：装备类卡牌（武器/圣遗物/特技）描述中提到自身类型是自描述
      if (rule.excludeIfSelfTag && rule.targetTags.some(t => card.tags.includes(t))) {
        continue;
      }

      // 检测关键词前是否有费用/数量运行时条件
      // "费用至少为3的「武器」" → 跳过
      // "初始包含至少6张「圣遗物」" → 不跳过（组牌条件）
      // "打出至少3种不同的「武器」" → 不跳过（组牌条件）
      const kwIndex = desc.indexOf(rule.keyword);
      const beforeKw = desc.slice(Math.max(0, kwIndex - 30), kwIndex);
      if (/费用/.test(beforeKw) && /至少|以上/.test(beforeKw)) continue;

      // 收集所有匹配目标标签的卡牌
      const targetCards = new Set<ActionCardRaw>();
      for (const tag of rule.targetTags) {
        for (const target of (cardsByTag.get(tag) ?? [])) {
          if (target.id !== card.id) targetCards.add(target);
        }
      }

      for (const target of targetCards) {
        addPair(card.id, target.id, rule.weight,
          `「${card.name}」效果涉及${rule.label}`,
          "synergy");
      }
    }
  }

  // ============================================================
  // 第三层：特定卡牌名称引用分析
  // ============================================================

  // 建立卡牌名称 → ID 的映射
  const cardNameToId = new Map<string, number>();
  for (const card of cards) {
    if (card.name.length >= 2) cardNameToId.set(card.name, card.id);
  }

  for (const card of cards) {
    const desc = card.description || "";
    if (!desc) continue;

    // 检查描述中是否提到了其他卡牌的名称
    for (const [name, targetId] of cardNameToId) {
      if (targetId === card.id) continue;
      if (desc.includes(name)) {
        addPair(card.id, targetId, 0.6,
          `「${card.name}」描述中提到「${name}」`,
          "synergy");
      }
    }
  }

  return pairs;
}

/**
 * 获取所有角色的基本信息（用于编辑器展示）。
 */
export function getAllCharacters(): Array<{ id: number; name: string; element: string; weapon: string }> {
  initCharacterMaps();
  const result: Array<{ id: number; name: string; element: string; weapon: string }> = [];
  for (const [id, c] of charById) {
    let element = "", weapon = "";
    for (const tag of c.tags) {
      if (ELEMENT_TAGS[tag]) element = ELEMENT_TAGS[tag];
      if (WEAPON_TAGS[tag]) weapon = WEAPON_TAGS[tag];
    }
    result.push({ id, name: c.name, element, weapon });
  }
  return result;
}
