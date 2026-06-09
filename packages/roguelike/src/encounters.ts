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

import type { GameData } from "@gi-tcg/core";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import type {
  RoguelikeConfig,
  Encounter,
  EncounterType,
  EnemyScript,
  Reward,
  NodeType,
  PathNode,
  CharacterPoolEntry,
} from "./types";
import { computeCardWeights } from "./card-weights";

// ============================================================
// 默认配置
// ============================================================

export const ROGUELIKE_CONFIG: RoguelikeConfig = {
  floors: [
    { floor: 1, path: ["normal", "normal", "elite", "shop", "boss"] },
    { floor: 2, path: ["normal", "elite", "normal", "shop", "elite", "boss"] },
    { floor: 3, path: ["normal", "elite", "elite", "shop", "elite", "boss"] },
    { floor: 4, path: ["boss"], skipCharacterSelection: true },
  ],
  initialCurrency: 0,
  shopCardCount: 10,
  rewardCardCount: 5,
  interestThreshold: 50,
  interestRate: 10,
};

// ============================================================
// 初始卡组生成
// ============================================================

const WEAPON_CARD_MAP: Record<string, number> = {
  sword: 311501, bow: 311201, catalyst: 311101, claymore: 311301, pole: 311401,
};
const DEFAULT_WEAPON_CARD = 332008;

const ARTIFACT_CARD_MAP: Record<string, number> = {
  cryo: 312101, hydro: 312201, pyro: 312301, electro: 312401,
  anemo: 312501, geo: 312601, dendro: 312701,
};

const BEST_PARTNER = 332001;
const MONDSTADT_HASH_BROWN = 333006;

/** 根据角色标签生成对应卡牌 */
function cardsForCharacter(tags: string[]): number[] {
  const cards: number[] = [];
  const weaponTag = tags.find((t) => WEAPON_CARD_MAP[t] !== undefined);
  cards.push(weaponTag ? WEAPON_CARD_MAP[weaponTag] : DEFAULT_WEAPON_CARD);
  const elementTag = tags.find((t) => ARTIFACT_CARD_MAP[t] !== undefined);
  if (elementTag) cards.push(ARTIFACT_CARD_MAP[elementTag]);
  return cards;
}

/** 根据角色标签列表生成初始卡组 */
export function generateInitialDeck(characterTagsList: string[][]): number[] {
  const deck = characterTagsList.flatMap(cardsForCharacter);
  deck.push(BEST_PARTNER, BEST_PARTNER, MONDSTADT_HASH_BROWN, MONDSTADT_HASH_BROWN);
  return deck;
}

/** 追加角色时生成对应卡牌 */
export function generateCharacterCards(tags: string[]): number[] {
  return cardsForCharacter(tags);
}

// ============================================================
// 敌人血量
// ============================================================

const FLOOR_HP_MULTIPLIER = [1.0, 1.5, 2.0, 2.5];
const BASE_HP = { normal: 10, elite: 20, boss: 30 };

export function getEnemyHp(floor: number, type: "normal" | "elite" | "boss"): number {
  const base = BASE_HP[type];
  const multiplier = FLOOR_HP_MULTIPLIER[floor - 1] ?? 1.0;
  const hp = Math.round(base * multiplier);
  const variance = Math.floor(Math.random() * 11) - 5;
  return Math.max(1, hp + variance);
}

export const BOSS_PHASE_HP = 15;

// ============================================================
// 经济系统
// ============================================================

export const ENCOUNTER_CURRENCY: Record<EncounterType, number> = {
  normal: 5, elite: 10, boss: 30,
};

export const SHOP_CARD_PRICE_MIN = 1;
export const SHOP_CARD_PRICE_MAX = 5;

export function getRefreshCost(refreshCount: number): number {
  return Math.round(2 * Math.pow(1.5, refreshCount));
}

export function getDeleteCost(deleteCount: number): number {
  return Math.round(10 * Math.pow(1.5, deleteCount));
}

export function getInterest(currency: number, threshold: number, rate: number): number {
  return Math.floor(Math.min(currency, threshold) / rate);
}

// ============================================================
// 采样工具
// ============================================================

/** Fisher-Yates 部分采样（均匀分布） */
function sample<T>(arr: readonly T[], count: number): T[] {
  const copy = [...arr];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/** 加权随机采样（无放回） */
function weightedSample<T>(items: T[], weights: number[], count: number): T[] {
  const remaining = [...items];
  const remainingWeights = [...weights];
  const n = Math.min(count, remaining.length);
  const result: T[] = [];

  for (let i = 0; i < n; i++) {
    const totalWeight = remainingWeights.reduce((s, w) => s + w, 0);
    if (totalWeight <= 0) break;
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < remainingWeights.length - 1; idx++) {
      r -= remainingWeights[idx];
      if (r <= 0) break;
    }
    result.push(remaining[idx]);
    remaining.splice(idx, 1);
    remainingWeights.splice(idx, 1);
  }
  return result;
}

// ============================================================
// 卡牌池
// ============================================================

/** 初始卡牌 ID（不出现在奖励/商店中）- 从 map 自动推导 */
const INITIAL_CARD_IDS = new Set([
  ...Object.values(WEAPON_CARD_MAP),
  DEFAULT_WEAPON_CARD,
  ...Object.values(ARTIFACT_CARD_MAP),
  BEST_PARTNER,
  MONDSTADT_HASH_BROWN,
]);

// ============================================================
// 特殊条件卡牌
// ============================================================

/** 元素共鸣卡：需要 2 个相同元素角色 */
const ELEMENTAL_RESONANCE_CARDS: Record<string, number[]> = {
  cryo:    [331101, 331102],
  hydro:   [331201, 331202],
  pyro:    [331301, 331302],
  electro: [331401, 331402],
  anemo:   [331501, 331502],
  geo:     [331601, 331602],
  dendro:  [331701, 331702],
};

/** 元素幻变卡：需要特定元素组合 */
const ELEMENTAL_TRANSMUTATION_CARDS: { id: number; elements: string[] }[] = [
  { id: 331004, elements: ["cryo", "electro"] },   // 超导祝佑
  { id: 331005, elements: ["hydro", "pyro"] },      // 蒸发祝佑
  { id: 331006, elements: ["dendro", "hydro"] },    // 绽放祝佑
  { id: 331007, elements: ["pyro", "geo"] },        // 火岩祝佑
  { id: 331008, elements: ["cryo", "dendro"] },     // 冰草祝佑
  { id: 331009, elements: ["electro", "anemo"] },   // 雷风祝佑
];

/** 区域共鸣卡：需要 2 个相同区域/阵营角色 */
const REGION_RESONANCE_CARDS: Record<string, number[]> = {
  mondstadt: [331801],         // 风与自由
  liyue:     [331802],         // 岩与契约
  inazuma:   [331803],         // 雷与永恒
  sumeru:    [331804],         // 草与智慧
  fontaine:  [331805],         // 水与正义
  natlan:    [331806],         // 火与战争
  nodkrai:   [331807, 331721], // 月与故乡 + 月兆·满辉
  fatui:     [332016],         // 愚人众的阴谋
  monster:   [332015],         // 深渊的呼唤
};

/** 需要条件才能加入卡池的特殊卡牌 ID 集合 */
const CONDITIONAL_CARD_IDS = new Set([
  ...Object.values(ELEMENTAL_RESONANCE_CARDS).flat(),
  ...ELEMENTAL_TRANSMUTATION_CARDS.map((c) => c.id),
  ...Object.values(REGION_RESONANCE_CARDS).flat(),
]);

/** 从共鸣卡 map 推导元素和区域列表，避免硬编码 */
const ALL_ELEMENTS = Object.keys(ELEMENTAL_RESONANCE_CARDS);
const ALL_REGIONS = Object.keys(REGION_RESONANCE_CARDS);

/** 获取角色的元素和区域/阵营标签 */
function getCharacterTags(id: number, data: GameData): { element: string; region: string | null } {
  const def = data.characters.get(id);
  if (!def) return { element: "", region: null };
  const tags = def.tags.map(String);
  const element = tags.find((t) => ALL_ELEMENTS.includes(t)) ?? "";
  const region = tags.find((t) => ALL_REGIONS.includes(t)) ?? null;
  return { element, region };
}

/**
 * 根据队伍角色动态生成卡池。
 * - 普通卡牌：所有 3xxxxx 行动牌（排除天赋牌、初始卡牌、条件卡牌）
 * - 天赋牌：仅包含队伍中角色的天赋牌
 * - 元素共鸣：队伍中有 2+ 同元素角色时可用
 * - 元素幻变：队伍中有对应元素组合时可用
 * - 区域共鸣：队伍中有 2+ 同区域角色时可用
 */
/** 获取卡牌名称（自动适配语言） */
export function getCardName(id: number): string {
  return DEFAULT_ASSETS_MANAGER.getNameSync(id) ?? `Card #${id}`;
}

export function generateCardPool(data: GameData, characterIds: number[] = [], floor: number = 1): { cardId: number; name: string }[] {
  const pool: { cardId: number; name: string }[] = [];

  // 收集队伍信息
  const teamElements = new Map<string, number>();
  const teamRegions = new Map<string, number>();
  const teamCharacterSet = new Set(characterIds);

  for (const id of characterIds) {
    const { element, region } = getCharacterTags(id, data);
    if (element) teamElements.set(element, (teamElements.get(element) ?? 0) + 1);
    if (region) teamRegions.set(region, (teamRegions.get(region) ?? 0) + 1);
  }

  for (const [id, def] of data.entities) {
    // 排除初始卡牌和非可打出类型
    if (INITIAL_CARD_IDS.has(id)) continue;
    if (def.type === "status" || def.type === "combatStatus" || def.type === "summon") continue;

    // 天赋牌（2xxxxx）：仅包含队伍中角色的天赋牌（obtainable=false，需先于 obtainable 检查）
    if (id >= 200000 && id < 300000) {
      const charIdStr = String(id).slice(1, 5);
      const charId = parseInt(charIdStr, 10);
      if (teamCharacterSet.has(charId)) {
        pool.push({ cardId: id, name: getCardName(id) });
      }
      continue;
    }

    // 条件卡牌（共鸣、幻变等，obtainable=false，需先于 obtainable 检查）
    if (CONDITIONAL_CARD_IDS.has(id)) continue;

    // 排除不可获取卡牌
    if (def.obtainable === false) continue;

    // 普通行动牌（3xxxxx）
    if (id >= 300000 && id < 400000) {
      pool.push({ cardId: id, name: getCardName(id) });
    }
  }

  // 元素共鸣卡：队伍中有 2+ 同元素角色
  for (const [element, cardIds] of Object.entries(ELEMENTAL_RESONANCE_CARDS)) {
    if ((teamElements.get(element) ?? 0) >= 2) {
      for (const cardId of cardIds) {
        pool.push({ cardId, name: getCardName(cardId) });
      }
    }
  }

  // 元素幻变卡：仅第4层（4角色），且队伍中恰好只有对应两种元素
  if (characterIds.length >= 4 && teamElements.size === 2) {
    for (const card of ELEMENTAL_TRANSMUTATION_CARDS) {
      const hasAll = card.elements.every((e) => (teamElements.get(e) ?? 0) >= 1);
      if (hasAll) {
        pool.push({ cardId: card.id, name: getCardName(card.id) });
      }
    }
  }

  // 区域共鸣卡：队伍中有 2+ 同区域角色
  for (const [region, cardIds] of Object.entries(REGION_RESONANCE_CARDS)) {
    if ((teamRegions.get(region) ?? 0) >= 2) {
      for (const cardId of cardIds) {
        pool.push({ cardId, name: getCardName(cardId) });
      }
    }
  }

  return pool;
}

/** 默认卡牌池 ID 列表（用于不传 GameData 的场景，如测试） */
const DEFAULT_CARD_POOL_IDS = [
  // 4星武器
  311502, 311505, 311202, 311102, 311105, 311302, 311305, 311402, 311406, 311206,
  // 5星武器
  311503, 311504, 311203, 311204, 311103, 311104, 311303, 311304, 311403, 311405,
  // 圣遗物
  312102, 312202, 312302, 312402, 312502, 312602, 312702, 312001, 312004, 312008,
  312010, 312014, 312018, 312029, 312041, 312045,
  // 事件牌
  332001, 333006, 332008, 330001, 330002, 330003, 330004, 330005, 330006, 330007,
];
const DEFAULT_CARD_POOL = DEFAULT_CARD_POOL_IDS.map((id) => ({ cardId: id, name: getCardName(id) }));

export interface RollCardsOptions {
  data?: GameData;
  characterIds?: number[];
  floor?: number;
  deckCards?: number[];
}

export function rollCards(count: number, opts?: RollCardsOptions): { cardId: number; name: string }[] {
  const pool = opts?.data ? generateCardPool(opts.data, opts.characterIds, opts.floor) : DEFAULT_CARD_POOL;
  if (opts?.deckCards && opts.deckCards.length > 0) {
    const poolIds = pool.map((c) => c.cardId);
    const weights = computeCardWeights(poolIds, opts.deckCards);
    return weightedSample(pool, weights, count).map((c) => ({ ...c }));
  }
  return sample(pool, count).map((c) => ({ ...c }));
}

export function rollShopCards(count: number, opts?: RollCardsOptions): { cardId: number; name: string; cost: number }[] {
  return rollCards(count, opts).map((card) => ({
    ...card,
    cost: SHOP_CARD_PRICE_MIN + Math.floor(Math.random() * (SHOP_CARD_PRICE_MAX - SHOP_CARD_PRICE_MIN + 1)),
  }));
}

// ============================================================
// 敌人定义（AI 自动选择技能，无需预设脚本）
// ============================================================

function enemyDef(name: string, charId: number): EnemyScript {
  return { name, characters: [charId], cards: [], behaviors: [] };
}

const CRYO_CICIN_MAGE = enemyDef("冰萤术士", 2101);
const CRYO_HYPOSTASIS = enemyDef("冰无相", 2103);
const MAGUU_KENKI = enemyDef("魔偶剑鬼", 2501);
const ELECTRO_HYPOSTASIS = enemyDef("雷无相", 2401);
const BOSS_DVALIN = enemyDef("风龙特瓦林", 2502);

// ============================================================
// 遭遇池
// ============================================================

export const NORMAL_ENCOUNTERS: Encounter[] = [
  { type: "normal", script: CRYO_CICIN_MAGE },
  { type: "normal", script: CRYO_HYPOSTASIS },
];

export const ELITE_ENCOUNTERS: Encounter[] = [
  { type: "elite", script: MAGUU_KENKI },
  { type: "elite", script: ELECTRO_HYPOSTASIS },
];

export const BOSS_ENCOUNTERS: Encounter[] = [
  { type: "boss", script: BOSS_DVALIN },
];

export function generateFloorPath(pathTypes: NodeType[]): PathNode[] {
  return pathTypes.map((type) => {
    switch (type) {
      case "normal": return { type, encounters: sample(NORMAL_ENCOUNTERS, 2), completed: false };
      case "elite": return { type, encounters: sample(ELITE_ENCOUNTERS, 2), completed: false };
      case "boss": return { type, encounters: sample(BOSS_ENCOUNTERS, 1), completed: false };
      case "shop": return { type, encounters: [], completed: false };
    }
  });
}

// ============================================================
// 角色池
// ============================================================

const WEAPON_TAGS = new Set(["sword", "bow", "catalyst", "claymore", "pole"]);

/** 从 GameData 动态生成可选角色池（排除怪物角色 2xxx+） */
export function generateCharacterPool(data: GameData): CharacterPoolEntry[] {
  const pool: CharacterPoolEntry[] = [];
  for (const [id, def] of data.characters) {
    if (id >= 2000) continue; // 排除怪物
    const tags = def.tags.map(String);
    const element = ALL_ELEMENTS.find((e) => tags.includes(e)) ?? "";
    const weapon = tags.find((t) => WEAPON_TAGS.has(t)) ?? "";
    pool.push({ id, name: getCardName(id), element, weapon });
  }
  return pool;
}

export function rollCharacterChoices(count: number, data: GameData, excludeIds: number[] = [], cachedPool?: CharacterPoolEntry[]): CharacterPoolEntry[] {
  const pool = cachedPool ?? generateCharacterPool(data);
  const excluded = new Set(excludeIds);
  const available = pool.filter((c) => !excluded.has(c.id));
  return sample(available, count);
}

/** 卡牌/角色图片 URL */
export function getImageUrl(id: number): string {
  return DEFAULT_ASSETS_MANAGER.getImageUrlSync(id, { type: "cardFace" });
}

/** 图片加载失败时的占位图 */
export const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160' viewBox='0 0 120 160'%3E%3Crect fill='%23334155' width='120' height='160' rx='8'/%3E%3Ctext fill='%2394a3b8' font-size='14' x='60' y='80' text-anchor='middle' dominant-baseline='middle'%3E%3F%3C/text%3E%3C/svg%3E";
