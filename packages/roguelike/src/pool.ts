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
import type {
  Encounter,
  EncounterType,
  EnemyConfig,
  NodeType,
  PathNode,
  CharacterPoolEntry,
} from "./types";
import { DEFAULT_ENEMY_POOL } from "./data";
import {
  WEAPON_CARD_MAP,
  DEFAULT_WEAPON_CARD,
  ARTIFACT_CARD_MAP,
  MONDSTADT_HASH_BROWN,
  ALL_ELEMENTS,
  WEAPON_TAGS,
} from "./data";
import { getCardName, sample } from "./utils";

// ============================================================
// 卡牌查询
// ============================================================

export interface CardEntry { id: number; name: string }

/** 查询所有支援牌（按类型分组） */
export function querySupportCards(data: GameData): Record<string, CardEntry[]> {
  const groups: Record<string, CardEntry[]> = {};
  const supportTagLabels: Record<string, string> = {
    place: "场地", ally: "伙伴", item: "道具", blessing: "元素助佑", adventureSpot: "冒险地点",
  };
  for (const [id, def] of data.entities) {
    if (def.type !== "support") continue;
    const tag = def.tags.find((t) => t in supportTagLabels);
    const group = tag ? supportTagLabels[tag] : "其他";
    (groups[group] ??= []).push({ id, name: getCardName(id) });
  }
  return groups;
}

/** 按实体类型和标签查询卡牌 */
function queryCardsByTypeAndTag(data: GameData, type: string, tag: string): CardEntry[] {
  const cards: CardEntry[] = [];
  for (const [id, def] of data.entities) {
    if (def.type === type && (def.tags as string[]).includes(tag)) {
      cards.push({ id, name: getCardName(id) });
    }
  }
  return cards;
}

/** 查询所有食物卡 */
export const queryFoodCards = (data: GameData) => queryCardsByTypeAndTag(data, "eventCard", "food");

/** 查询所有圣遗物装备卡 */
export const queryArtifactCards = (data: GameData) => queryCardsByTypeAndTag(data, "equipment", "artifact");

// ============================================================
// 角色池
// ============================================================

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

// ============================================================
// 初始卡组生成
// ============================================================

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
  // 最好的伙伴 ×2 由事件 #2001 初遇派蒙提供，不再初始赠送
  deck.push(MONDSTADT_HASH_BROWN, MONDSTADT_HASH_BROWN);
  return deck;
}

/** 追加角色时生成对应卡牌 */
export function generateCharacterCards(tags: string[]): number[] {
  return cardsForCharacter(tags);
}

// ============================================================
// 遭遇创建
// ============================================================

/** 敌人池类型（按遭遇等级分组） */
export type EnemyPool = { normal: EnemyConfig[]; elite: EnemyConfig[]; boss: EnemyConfig[] };

/** 从 EnemyConfig 创建遭遇（支持单个或多个敌人） */
export function createEncounter(type: EncounterType, configs: EnemyConfig | EnemyConfig[]): Encounter {
  const configArray = Array.isArray(configs) ? configs : [configs];
  return { type, configs: configArray };
}

/** 从遭遇配置中获取显示名称 */
export function getEncounterName(encounter: Encounter, nameFn?: (id: number) => string): string {
  const ids = encounter.configs.filter((c) => c?.characterId > 0).map((c) => c.characterId);
  if (ids.length === 0) return "Unknown Enemy";
  const fn = nameFn ?? getCardName;
  return ids.map((id) => fn(id)).join(" & ");
}

/** 从遭遇配置中获取所有角色 ID */
export function getEncounterCharacterIds(encounter: Encounter): number[] {
  return encounter.configs.filter((c) => c?.characterId > 0).map((c) => c.characterId);
}

// ============================================================
// 遭遇池（从默认敌人池动态生成）
// ============================================================

/** 按遭遇类型采样敌人并生成遭遇列表 */
function sampleEncounters(type: EncounterType, count: number, enemyPool?: EnemyConfig[]): Encounter[] {
  const pool = enemyPool ?? DEFAULT_ENEMY_POOL[type as keyof typeof DEFAULT_ENEMY_POOL];
  return sample(pool, count).map((config) => createEncounter(type, config));
}

// ============================================================
// 楼层路径生成
// ============================================================

export function generateFloorPath(
  pathTypes: NodeType[],
  encounterConfigs?: (EnemyConfig[][] | null)[],
  enemyPool?: EnemyPool,
  fixedEventIds?: (number | null)[],
): PathNode[] {
  let eventIndex = 0;
  return pathTypes.map((type, i) => {
    if (type === "shop") return { type, encounters: [], completed: false };
    if (type === "event") {
      const fixedId = fixedEventIds?.[eventIndex++] ?? undefined;
      return { type, encounters: [], completed: false, fixedEventId: fixedId ?? undefined };
    }
    const encType = type as EncounterType;
    const preConfigured = encounterConfigs?.[i];
    if (preConfigured && preConfigured.length > 0) {
      // 每个遭遇包含多个敌人配置
      const encounters = preConfigured
        .filter((cfgs) => cfgs && cfgs.length > 0 && cfgs.some((cfg) => cfg?.characterId > 0))
        .map((cfgs) => createEncounter(encType, cfgs));
      if (encounters.length > 0) {
        return { type, encounters, completed: false };
      }
    }
    const count = type === "boss" ? 1 : 2;
    const poolForType = enemyPool?.[encType];
    return { type, encounters: sampleEncounters(encType, count, poolForType), completed: false };
  });
}
