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

import type { EncounterType, EnemyModifier, EnemyConfig } from "./types";
import { validateIds } from "./utils";

// ============================================================
// 初始卡组卡牌 ID 映射
// ============================================================

export const WEAPON_CARD_MAP: Record<string, number> = {
  sword: 311501, bow: 311201, catalyst: 311101, claymore: 311301, pole: 311401,
};
export const DEFAULT_WEAPON_CARD = 332008;

export const ARTIFACT_CARD_MAP: Record<string, number> = {
  cryo: 312101, hydro: 312201, pyro: 312301, electro: 312401,
  anemo: 312501, geo: 312601, dendro: 312701,
};

export const BEST_PARTNER = 332001;
export const MONDSTADT_HASH_BROWN = 333006;

// ============================================================
// 条件卡牌数据
// ============================================================

/** 元素共鸣卡：需要 2 个相同元素角色 */
export const ELEMENTAL_RESONANCE_CARDS: Record<string, number[]> = {
  cryo:    [331101, 331102],
  hydro:   [331201, 331202],
  pyro:    [331301, 331302],
  electro: [331401, 331402],
  anemo:   [331501, 331502],
  geo:     [331601, 331602],
  dendro:  [331701, 331702],
};

/** 元素幻变卡：需要特定元素组合 */
export const ELEMENTAL_TRANSMUTATION_CARDS: { id: number; elements: string[] }[] = [
  { id: 331004, elements: ["cryo", "electro"] },   // 超导祝佑
  { id: 331005, elements: ["hydro", "pyro"] },      // 蒸发祝佑
  { id: 331006, elements: ["dendro", "hydro"] },    // 绽放祝佑
  { id: 331007, elements: ["pyro", "geo"] },        // 火岩祝佑
  { id: 331008, elements: ["cryo", "dendro"] },     // 冰草祝佑
  { id: 331009, elements: ["electro", "anemo"] },   // 雷风祝佑
];

/** 区域共鸣卡：需要 2 个相同区域/阵营角色 */
export const REGION_RESONANCE_CARDS: Record<string, number[]> = {
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
export const CONDITIONAL_CARD_IDS = new Set([
  ...Object.values(ELEMENTAL_RESONANCE_CARDS).flat(),
  ...ELEMENTAL_TRANSMUTATION_CARDS.map((c) => c.id),
  ...Object.values(REGION_RESONANCE_CARDS).flat(),
]);

/** 从共鸣卡 map 推导元素和区域列表，避免硬编码 */
export const ALL_ELEMENTS = Object.keys(ELEMENTAL_RESONANCE_CARDS);
export const ALL_REGIONS = Object.keys(REGION_RESONANCE_CARDS);

// ============================================================
// 角色标签
// ============================================================

export const WEAPON_TAGS = new Set(["sword", "bow", "catalyst", "claymore", "pole"]);

// ============================================================
// 敌人血量
// ============================================================

/**
 * 楼层 HP 倍率（索引 = floor - 1）
 * 公式：HP = BASE_HP[type] * FLOOR_HP_MULTIPLIER[floor - 1]
 */
export const FLOOR_HP_MULTIPLIER = [1.0, 1.5, 2.0, 2.5];

/** 基础 HP（按遭遇类型） */
export const BASE_HP = { normal: 10, elite: 20, boss: 30 };

// ============================================================
// 经济系统常量
// ============================================================

/** 遭遇类型对应的默认货币奖励 */
export const ENCOUNTER_CURRENCY: Record<EncounterType, number> = {
  normal: 5, elite: 10, boss: 30,
};

/** 商店卡牌价格范围 */
export const SHOP_CARD_PRICE_MIN = 1;
export const SHOP_CARD_PRICE_MAX = 5;

/**
 * 刷新/删牌费用增长系数
 * 公式：cost = base * SHOP_COST_GROWTH_RATE ^ count
 * - 刷新基础费用 = 2
 * - 删牌基础费用 = 10
 */
export const SHOP_COST_GROWTH_RATE = 1.5;

// ============================================================
// 队伍与角色选择
// ============================================================

export const MAX_TEAM_SIZE = 4;
export const CHARACTER_CHOICE_COUNT = 4;

// ============================================================
// 默认卡牌池 ID（用于不传 GameData 的场景，如测试）
// ============================================================

export const DEFAULT_CARD_POOL_IDS = [
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

// ============================================================
// 默认敌人修饰器
// ============================================================

/** 天守阁实体 ID */
export const TENSHUKAKU_ENTITY_ID = 321007;

/** 新建敌人时的默认修饰器列表（天守阁支援牌） */
export const DEFAULT_ENEMY_MODIFIERS: EnemyModifier[] = [
  { type: "supportCard", value: TENSHUKAKU_ENTITY_ID },
];

/**
 * 已知可用的 status ID 列表（均在 @gi-tcg/data 中预定义）。
 *
 * 这些 ID 在运行时从 GameData.entities 中查找，
 * 不在此处调用 status() builder，避免 RegistrationScope 问题。
 */
export const KNOWN_STATUS_IDS = {
  /** 免疫控制（冻结/石化/眩晕）— 抵抗之躯 */
  IMMUNE_CONTROL: 100,
  /** 复活至 1 HP — 雷晶核心（通用，无角色限制） */
  REVIVE: 124014,
  PVE_FULL_REVIVE: 9000001,
  /** 通用伤害增加 — 造成伤害 +1（每个可用次数） */
  DAMAGE_BOOST: 210,
  /** 通用伤害减免 — 受到伤害 -1（每个可用次数） */
  DAMAGE_REDUCTION: 211,
  /** 每回合自动料理 — 每回合开始附着随机食物效果 */
  AUTO_DISH_PER_ROUND: 212,
} as const;

/**
 * 验证 KNOWN_STATUS_IDS 中的所有 status ID 是否存在于 GameData 中。
 */
export function validateStatusIds(entities: ReadonlyMap<number, unknown>): string[] {
  return validateIds(Object.values(KNOWN_STATUS_IDS), entities, "Status");
}

// ============================================================
// 敌人数据
// ============================================================

/** [characterId, tier] — name 从 assets-manager 动态获取 */
const ENEMY_DEFS: [number, EncounterType][] = [
  // Normal
  [2101, "normal"], [2104, "normal"], [2202, "normal"], [2205, "normal"],
  [2203, "normal"], [2207, "normal"], [2301, "normal"], [2303, "normal"],
  [2302, "normal"], [2404, "normal"], [2405, "normal"], [2406, "normal"],
  [2503, "normal"], [2601, "normal"], [2604, "normal"], [2703, "normal"],
  [2705, "normal"],
  // Elite
  [2103, "elite"], [2201, "elite"], [2206, "elite"], [2304, "elite"],
  [2306, "elite"], [2401, "elite"], [2402, "elite"], [2403, "elite"],
  [2501, "elite"], [2603, "elite"], [2605, "elite"], [2701, "elite"],
  [2704, "elite"],
  // Boss
  [2102, "boss"], [2204, "boss"], [2305, "boss"], [2502, "boss"],
  [2602, "boss"], [2702, "boss"],
  // Roguelike 专属 Boss
  [9002, "boss"],  // 极恶骑·苏尔特洛奇
];

function makeConfig(characterId: number): EnemyConfig {
  return { characterId, hpOverride: null, currencyReward: null, modifiers: [...DEFAULT_ENEMY_MODIFIERS] };
}

const byTier = (tier: EncounterType): EnemyConfig[] =>
  ENEMY_DEFS.filter(([, t]) => t === tier).map(([id]) => makeConfig(id));

export const ALL_NORMAL_ENEMIES = byTier("normal");
export const ALL_ELITE_ENEMIES = byTier("elite");
export const ALL_BOSS_ENEMIES = byTier("boss");

/** 所有怪物角色 ID 集合（用于排除怪物天赋牌） */
export const ENEMY_CHARACTER_IDS = new Set(ENEMY_DEFS.map(([id]) => id));

export const DEFAULT_ENEMY_POOL = {
  normal: ALL_NORMAL_ENEMIES,
  elite: ALL_ELITE_ENEMIES,
  boss: ALL_BOSS_ENEMIES,
};

/**
 * 验证 ENEMY_DEFS 中的所有 characterId 是否存在于 GameData 中。
 * 用于启动时检测数据包变更导致的 ID 失效。
 */
export function validateEnemyIds(characters: ReadonlyMap<number, unknown>): string[] {
  return validateIds(ENEMY_DEFS.map(([id]) => id), characters, "Enemy character");
}

// ============================================================
// 经济系统函数
// ============================================================

/**
 * 计算敌人 HP
 * @param floor - 当前楼层（1-based）
 * @param type - 遭遇类型
 * @returns HP = BASE_HP[type] * FLOOR_HP_MULTIPLIER[floor - 1]，最低 1
 */
export function getEnemyHp(floor: number, type: "normal" | "elite" | "boss"): number {
  const base = BASE_HP[type];
  const multiplier = FLOOR_HP_MULTIPLIER[floor - 1] ?? 1.0;
  return Math.max(1, Math.round(base * multiplier));
}

/** 获取遭遇的货币奖励（configs 中第一个有效覆盖 > 类型默认值） */
export function getEncounterCurrency(encounter: { configs: { currencyReward: number | null }[]; type: EncounterType }): number {
  const firstValidConfig = encounter.configs.find((c) => c.currencyReward !== null);
  return firstValidConfig?.currencyReward ?? ENCOUNTER_CURRENCY[encounter.type] ?? 0;
}

/** 计算商店刷新费用：2 * 1.5^refreshCount（向上取整） */
export function getRefreshCost(refreshCount: number): number {
  return Math.round(2 * Math.pow(SHOP_COST_GROWTH_RATE, refreshCount));
}

/** 计算删牌费用：10 * 1.5^deleteCount（向上取整） */
export function getDeleteCost(deleteCount: number): number {
  return Math.round(10 * Math.pow(SHOP_COST_GROWTH_RATE, deleteCount));
}

/**
 * 计算利息收入
 * @param currency - 当前货币
 * @param threshold - 利息上限
 * @param rate - 每 N 货币获得 1 利息
 * @returns 利息 = floor(min(currency, threshold) / rate)
 */
export function getInterest(currency: number, threshold: number, rate: number): number {
  return Math.floor(Math.min(currency, threshold) / rate);
}

// ============================================================
// 默认事件（定义在 default-events.ts，此处重新导出以保持兼容）
// ============================================================

export { DEFAULT_EVENTS, FALLBACK_EVENT_IDS } from "./default-events";

export { ROGUELIKE_CONFIG } from "./default-levels";
