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

import type { RoguelikeConfig, EncounterType, EnemyModifier, EventDefinition } from "./types";

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

// ============================================================
// 默认事件
// ============================================================

export const DEFAULT_EVENTS: EventDefinition[] = [
  {
    id: 1001,
    name: "旅人的馈赠",
    eventTag: "positive",
    imageUrl: "",
    storyTemplate: "{{playerNames}} 在旅途中遇到了一位神秘的旅人。旅人被你们的勇气所打动，赠予了一些费用作为资助。",
    conditions: [
      { condition: { type: "floorAtLeast", floor: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCurrency", amount: 5 },
    ],
  },
  {
    id: 1002,
    name: "最好的伙伴",
    eventTag: "positive",
    imageUrl: "",
    storyTemplate: "{{playerNames}} 在路边发现了一张熟悉的脸孔——最好的伙伴正等待着你们的到来！伙伴加入了队伍，带来了更多的卡牌选择。",
    conditions: [
      { condition: { type: "hasCard", cardId: BEST_PARTNER, minCount: 2 }, weight: 3 },
    ],
    effects: [
      { type: "addRandomCards", count: 2 },
    ],
  },
  {
    id: 1003,
    name: "元素共鸣之力",
    eventTag: "positive",
    imageUrl: "",
    storyTemplate: "{{playerNames}} 感受到了元素之间的共鸣力量。这种力量强化了你们的战斗能力，让你们在接下来的战斗中更加得心应手。",
    conditions: [
      { condition: { type: "hasCharacterTag", tag: "pyro", minCount: 2 }, weight: 2 },
    ],
    effects: [
      { type: "addCurrency", amount: 8 },
    ],
  },
  {
    id: 1004,
    name: "深渊的低语",
    eventTag: "negative",
    imageUrl: "",
    storyTemplate: "{{playerNames}} 在黑暗中听到了深渊的低语。一股不祥的力量笼罩了你们，让你们失去了一些费用。",
    conditions: [
      { condition: { type: "currencyAtLeast", amount: 15 }, weight: 2 },
    ],
    effects: [
      { type: "removeCurrency", amount: 8 },
    ],
  },
  {
    id: 1005,
    name: "迷失方向",
    eventTag: "negative",
    imageUrl: "",
    storyTemplate: "{{playerNames}} 在迷雾中迷失了方向。你们不得不绕路前行，这消耗了额外的时间和精力。",
    conditions: [
      { condition: { type: "floorAtLeast", floor: 2 }, weight: 1 },
    ],
    effects: [
      { type: "removeCurrency", amount: 5 },
    ],
  },
  {
    id: 1006,
    name: "神秘商人",
    eventTag: "positive",
    imageUrl: "",
    storyTemplate: "{{playerNames}} 遇到了一位神秘的商人。商人以极低的价格出售了一些珍贵的卡牌。",
    conditions: [
      { condition: { type: "deckSizeAtLeast", count: 10 }, weight: 2 },
    ],
    effects: [
      { type: "addRandomCards", count: 3 },
    ],
  },
  {
    id: 1007,
    name: "生命之泉",
    eventTag: "positive",
    imageUrl: "",
    storyTemplate: "{{playerNames}} 发现了一处隐藏的生命之泉。泉水的力量治愈了你们的伤痛，提升了你们的生命上限。",
    conditions: [
      { condition: { type: "teamSizeAtLeast", count: 3 }, weight: 2 },
    ],
    effects: [
      { type: "modifyCharacterMaxHp", amount: 3 },
    ],
  },
];

// ============================================================
// 默认配置
// ============================================================

export const ROGUELIKE_CONFIG: RoguelikeConfig = {
  floors: [
    { floor: 1, path: ["normal", "event", "elite", "shop", "boss"] },
    { floor: 2, path: ["normal", "elite", "event", "shop", "boss"] },
    { floor: 3, path: ["event", "normal", "elite", "shop", "boss"] },
  ],
  initialCurrency: 0,
  shopCardCount: 10,
  rewardCardCount: 5,
  interestThreshold: 50,
  interestRate: 10,
  events: DEFAULT_EVENTS,
};
