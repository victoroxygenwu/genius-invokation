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

import type { RoguelikeConfig, EncounterType, EnemyModifier, EnemyConfig, EventDefinition } from "./types";
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

export const FLOOR_HP_MULTIPLIER = [1.0, 1.5, 2.0, 2.5];
export const BASE_HP = { normal: 10, elite: 20, boss: 30 };

// ============================================================
// 经济系统常量
// ============================================================

export const ENCOUNTER_CURRENCY: Record<EncounterType, number> = {
  normal: 5, elite: 10, boss: 30,
};

export const SHOP_CARD_PRICE_MIN = 1;
export const SHOP_CARD_PRICE_MAX = 5;

// 刷新/删牌费用公式
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
];

function makeConfig(characterId: number): EnemyConfig {
  return { characterId, hpOverride: null, currencyReward: null, modifiers: [...DEFAULT_ENEMY_MODIFIERS] };
}

const byTier = (tier: EncounterType): EnemyConfig[] =>
  ENEMY_DEFS.filter(([, t]) => t === tier).map(([id]) => makeConfig(id));

export const ALL_NORMAL_ENEMIES = byTier("normal");
export const ALL_ELITE_ENEMIES = byTier("elite");
export const ALL_BOSS_ENEMIES = byTier("boss");

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

export function getEnemyHp(floor: number, type: "normal" | "elite" | "boss"): number {
  const base = BASE_HP[type];
  const multiplier = FLOOR_HP_MULTIPLIER[floor - 1] ?? 1.0;
  return Math.max(1, Math.round(base * multiplier));
}

export const BOSS_PHASE_HP = 15;

/** 获取遭遇的货币奖励（configs 中第一个有效覆盖 > 类型默认值） */
export function getEncounterCurrency(encounter: { configs: { currencyReward: number | null }[]; type: EncounterType }): number {
  const firstValidConfig = encounter.configs.find((c) => c.currencyReward !== null);
  return firstValidConfig?.currencyReward ?? ENCOUNTER_CURRENCY[encounter.type] ?? 0;
}

export function getRefreshCost(refreshCount: number): number {
  return Math.round(2 * Math.pow(SHOP_COST_GROWTH_RATE, refreshCount));
}

export function getDeleteCost(deleteCount: number): number {
  return Math.round(10 * Math.pow(SHOP_COST_GROWTH_RATE, deleteCount));
}

export function getInterest(currency: number, threshold: number, rate: number): number {
  return Math.floor(Math.min(currency, threshold) / rate);
}

// ============================================================
// 默认事件
// ============================================================

export const DEFAULT_EVENTS: EventDefinition[] = [
  {
    id: 2001,
    name: "初遇派蒙",
    imageUrl: "/events/2001_first_meeting_paimon.jpg",
    storyTemplate: "{{playerNames}} 在旅途的起点遇到了一个奇妙的飞行生物——派蒙。她自告奋勇成为了你们的向导，并带来了两张「最好的伙伴」。",
    conditions: [],
    effects: [
      { type: "addCard", cardId: 332001, count: 2 },
    ],
  },
  {
    id: 2002,
    name: "寰宇之旅",
    imageUrl: "/events/2002_journey_across_worlds.jpg",
    storyTemplate: "{{playerNames}} 在旅途中发现了一道神秘的传送门。门后似乎通往另一个世界，充满了未知的可能性。虽然旅途充满风险，但收获也颇为丰厚。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1116 }, weight: 3 },
      { condition: { type: "defeatedEnemy", enemyId: 2204 }, weight: 3 },
    ],
    effects: [
      { type: "addCurrency", amount: 10 },
      { type: "chooseAndRemoveCard" },
    ],
  },
  {
    id: 2003,
    name: "在阳光更好的日子再会",
    imageUrl: "/events/2003_reunion_on_sunnier_day.jpg",
    storyTemplate: "{{playerNames}} 在须弥的旅途中遇到了一位故人。他带来了来自沙漠的消息，以及一些珍贵的物资。",
    conditions: [
      { condition: { type: "hasCharacterTag", tag: "sumeru", minCount: 2 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 321020, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 330012, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 331804, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 332040, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 332026, count: 2 },
      { type: "addCard", cardId: 322022, count: 2 },
      { type: "addCard", cardId: 332040, count: 2 },
    ],
  },
  {
    id: 2004,
    name: "要做优秀的巡林员",
    imageUrl: "/events/2004_excellent_forest_ranger.jpg",
    storyTemplate: "{{playerNames}} 在化城郭遇到了正在写日记的柯莱。她分享了巡林的经验，并为你们准备了一些物资。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1701 }, weight: 2 },
      { condition: { type: "hasCharacter", characterId: 1702 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 322017, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 321014, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 217011, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 217021, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 321014, count: 2 },
      { type: "modifyNextBattleEnemyHp", amount: -10 },
    ],
  },
  {
    id: 2005,
    name: "叮呤哐啷蛋卷工坊",
    imageUrl: "/events/2005_clanging_egg_roll_workshop.jpg",
    storyTemplate: "{{playerNames}} 来到了爱诺和伊涅芙的工坊。这里充满了各种奇妙的发明和改造方案。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1216 }, weight: 2 },
      { condition: { type: "hasCharacter", characterId: 1417 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 332061, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 332060, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 332062, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 212161, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 214171, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 332060, count: 1 },
      { type: "addCard", cardId: 332061, count: 1 },
      { type: "addCard", cardId: 332062, count: 1 },
    ],
  },
  {
    id: 2006,
    name: "霜月之坊",
    imageUrl: "/events/2006_frost_moon_shrine.jpg",
    storyTemplate: "{{playerNames}} 来到了霜月之坊。菈乌玛正在这里制作新的作品，她热情地邀请你们参与。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1711 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 321037, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 217111, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 217111, count: 1 },
      { type: "addCard", cardId: 321037, count: 1 },
      { type: "addCurrency", amount: 5 },
    ],
  },
  {
    id: 2007,
    name: "新月之拥",
    imageUrl: "/events/2007_embrace_of_new_moon.jpg",
    storyTemplate: "{{playerNames}} 在月光下感受到了一股神秘的力量。新月的光辉笼罩着你们，带来了祝福与力量。",
    conditions: [
      { condition: { type: "hasCharacterTag", tag: "nodkrai", minCount: 2 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 331807, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 331721, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 321035, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 330013, count: 1 },
      { type: "modifyNextBattleAllyHp", amount: 2 },
    ],
  },
  {
    id: 2008,
    name: "夜客致访",
    imageUrl: "/events/2008_night_visitor_arrives.jpg",
    storyTemplate: "{{playerNames}} 在夜色中遇到了一位神秘的来客。他带来了来自远方的消息和一些珍贵的物品。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1418 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 321036, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 214181, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 214181, count: 2 },
      { type: "addCard", cardId: 321036, count: 2 },
      { type: "removeCurrency", amount: 5 },
    ],
  },
  {
    id: 2009,
    name: "故事的种子",
    imageUrl: "/events/2009_seed_of_story.jpg",
    storyTemplate: "{{playerNames}} 在蒙德的酒馆里听到了一个古老的故事。故事中蕴含着强大的力量，为你们带来了新的可能。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1503 }, weight: 3 },
      { condition: { type: "hasCharacterTag", tag: "anemo", minCount: 2 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 331801, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 331501, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 331502, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 330004, count: 1 },
      { type: "addCard", cardId: 332019, count: 1 },
      { type: "addCard", cardId: 332024, count: 1 },
    ],
  },
  {
    id: 2010,
    name: "呀！呀！",
    imageUrl: "/events/2010_ya_ya.jpg",
    storyTemplate: "{{playerNames}} 在旅途中遇到了一群吵闹的小生物。它们的叫声让人心烦意乱，但也带来了一些意外的收获。",
    conditions: [
      { condition: { type: "hasCard", cardId: 313009, minCount: 2 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 332043, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 313009, count: 2 },
      { type: "addCurrency", amount: 15 },
    ],
  },
  {
    id: 2011,
    name: "闭嘴，哥们",
    imageUrl: "/events/2011_shut_up_buddy.jpg",
    storyTemplate: "{{playerNames}} 在旅途中遇到了一群不友好的生物。战斗一触即发，虽然你们最终获胜，但也付出了代价。",
    conditions: [
      { condition: { type: "hasAllCharacters", characterIds: [1517, 1709] }, weight: 3 },
      { condition: { type: "hasAnyCards", cardIds: [215171, 217091, 332050, 332044] }, weight: 1 },
    ],
    effects: [
      { type: "modifyNextBattleAllyHp", amount: -5 },
      { type: "modifyNextBattleEnemyHp", amount: -10 },
      { type: "addCurrency", amount: 10 },
    ],
  },
  {
    id: 2012,
    name: "不会吧，哥们",
    imageUrl: "/events/2012_no_way_buddy.jpg",
    storyTemplate: "{{playerNames}} 在旅途中发现了一条捷径。虽然需要放弃一些东西，但可以节省不少时间。",
    conditionMode: "and",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1517 }, weight: 3 },
      { condition: { type: "hasAnyCards", cardIds: [215171, 313006, 332050, 333016] }, weight: 2 },
    ],
    effects: [
      { type: "skipNextNormalBattle" },
      { type: "addCurrency", amount: 10 },
    ],
  },
  {
    id: 2013,
    name: "束手就擒！",
    imageUrl: "/events/2013_surrender_now.jpg",
    storyTemplate: "{{playerNames}} 在旅途中遇到了夏沃蕾。她正在追捕一群罪犯，并邀请你们加入。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1313 }, weight: 5 },
      { condition: { type: "teamOnlyElements", elements: ["pyro", "electro"] }, weight: 3 },
    ],
    conditionMode: "and",
    effects: [
      { type: "addCard", cardId: 213131, count: 2 },
      { type: "addCard", cardId: 312030, count: 2 },
      { type: "addCard", cardId: 331301, count: 1 },
    ],
  },
  {
    id: 2016,
    name: "束手就擒！（招募）",
    imageUrl: "/events/2013_surrender_now.jpg",
    storyTemplate: "{{playerNames}} 在旅途中遇到了正在追捕罪犯的夏沃蕾。她邀请你们协助，作为回报，她愿意加入你们的队伍。",
    conditions: [
      { condition: { type: "noCharacter", characterId: 1313 }, weight: 0 },
      { condition: { type: "teamOnlyElements", elements: ["pyro", "electro"] }, weight: 3 },
    ],
    conditionMode: "and",
    effects: [
      { type: "addCharacter", characterId: 1313 },
      { type: "addCard", cardId: 213131, count: 2 },
    ],
  },
  {
    id: 2014,
    name: "伟大圣龙库胡勒阿乔",
    imageUrl: "/events/2014_great_dragon_kuhuleahjo.jpg",
    storyTemplate: "{{playerNames}} 遭遇了传说中的伟大圣龙库胡勒阿乔。虽然你们成功击退了它，但也消耗了不少资源。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1709 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 217091, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 313002, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 321024, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "modifyNextBattleAllyHp", amount: 5 },
      { type: "modifyNextBattleEnemyHp", amount: -5 },
      { type: "removeCurrency", amount: 5 },
    ],
  },
  {
    id: 2015,
    name: "以极限之名",
    imageUrl: "/events/2015_in_name_of_limit.jpg",
    storyTemplate: "{{playerNames}} 决定挑战自己的极限。虽然获得了强大的力量，但也付出了代价。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1709 }, weight: 2 },
      { condition: { type: "hasCharacterTag", tag: "natlan", minCount: 2 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 332044, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 217091, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 313002, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 331806, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 332044, count: 2 },
      { type: "addCard", cardId: 332042, count: 2 },
      { type: "addCard", cardId: 313002, count: 2 },
    ],
  },
  {
    id: 2999,
    name: "旅途小憩",
    imageUrl: "/events/2999_rest_during_journey.jpg",
    storyTemplate: "{{playerNames}} 找到了一处安静的地方稍作休息，恢复了一些精力，为接下来的旅途做好了准备。",
    conditions: [],
    effects: [
      { type: "addCurrency", amount: 5 },
      { type: "modifyNextBattleAllyHp", amount: 2 },
    ],
  },
];

/** 回退事件 — 仅由 resolveEvent 在无条件事件可触发时使用 */
export const FALLBACK_EVENT_ID = 2999;

// ============================================================
// 默认配置
// ============================================================

export const ROGUELIKE_CONFIG: RoguelikeConfig = {
  floors: [
    { floor: 1, path: ["event", "normal", "event", "elite", "shop", "boss"], fixedEventIds: [2001] },
    { floor: 2, path: ["normal", "event", "elite", "shop", "boss"] },
    { floor: 3, path: ["normal", "event", "elite", "shop", "boss"] },
  ],
  initialCurrency: 0,
  shopCardCount: 10,
  rewardCardCount: 5,
  interestThreshold: 50,
  interestRate: 10,
  events: DEFAULT_EVENTS,
};
