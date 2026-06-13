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
import { computeCardWeights } from "./card-weights";
import { getCardName, sample, weightedSample, validateIds } from "./utils";
import {
  WEAPON_CARD_MAP,
  ARTIFACT_CARD_MAP,
  MONDSTADT_HASH_BROWN,
  ELEMENTAL_RESONANCE_CARDS,
  ELEMENTAL_TRANSMUTATION_CARDS,
  REGION_RESONANCE_CARDS,
  CONDITIONAL_CARD_IDS,
  ALL_ELEMENTS,
  ALL_REGIONS,
  DEFAULT_CARD_POOL_IDS,
  SHOP_CARD_PRICE_MIN,
  SHOP_CARD_PRICE_MAX,
  ENEMY_CHARACTER_IDS,
} from "./data";

// ============================================================
// 初始卡牌 ID 集合（不出现在奖励/商店中）
// ============================================================

export const INITIAL_CARD_IDS = new Set([
  ...Object.values(WEAPON_CARD_MAP),
  ...Object.values(ARTIFACT_CARD_MAP),
  MONDSTADT_HASH_BROWN,
]);

// ============================================================
// 卡牌验证
// ============================================================

/**
 * 验证硬编码的卡牌 ID 是否存在于 GameData 中。
 * 用于启动时检测数据包变更导致的 ID 失效。
 */
export function validateCardIds(entities: ReadonlyMap<number, unknown>): string[] {
  return [
    ...validateIds(INITIAL_CARD_IDS, entities, "Initial card"),
    ...validateIds(CONDITIONAL_CARD_IDS, entities, "Conditional card"),
  ];
}

// ============================================================
// 卡牌池生成
// ============================================================

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

    // 天赋牌（2xxxxx）：仅包含队伍中角色的天赋牌，排除怪物天赋牌
    if (id >= 200000 && id < 300000) {
      const charIdStr = String(id).slice(1, 5);
      const charId = parseInt(charIdStr, 10);
      if (ENEMY_CHARACTER_IDS.has(charId)) continue;
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

// ============================================================
// 卡牌滚动
// ============================================================

const DEFAULT_CARD_POOL = DEFAULT_CARD_POOL_IDS.map((id) => ({ cardId: id, name: getCardName(id) }));

export interface RollCardsOptions {
  data?: GameData;
  characterIds?: number[];
  floor?: number;
  deck?: number[];
  /** 自定义卡牌费用（cardId → cost），优先于默认随机费用 */
  cardCosts?: Record<number, number>;
}

/**
 * 从卡池中随机抽取卡牌。
 * - 有 GameData 时根据队伍角色动态生成卡池，否则使用默认卡池
 * - 有 deck 时使用加权采样（卡牌关联权重），否则均匀采样
 */
export function rollCards(count: number, opts?: RollCardsOptions): { cardId: number; name: string }[] {
  const pool = opts?.data ? generateCardPool(opts.data, opts.characterIds, opts.floor) : DEFAULT_CARD_POOL;
  if (opts?.deck && opts.deck.length > 0) {
    const poolIds = pool.map((c) => c.cardId);
    const weights = computeCardWeights(poolIds, opts.deck);
    return weightedSample(pool, weights, count).map((c) => ({ ...c }));
  }
  return sample(pool, count).map((c) => ({ ...c }));
}

/** 商店卡牌默认费用（未设置自定义费用时使用） */
export const DEFAULT_SHOP_CARD_COST = 5;

/**
 * 生成商店卡牌列表（在 rollCards 基础上附加费用）。
 * 费用优先使用 opts.cardCosts 中的自定义值，否则使用 DEFAULT_SHOP_CARD_COST。
 */
export function rollShopCards(count: number, opts?: RollCardsOptions): { cardId: number; name: string; cost: number }[] {
  const cardCosts = opts?.cardCosts;
  return rollCards(count, opts).map((card) => ({
    ...card,
    cost: cardCosts?.[card.cardId] ?? DEFAULT_SHOP_CARD_COST,
  }));
}
