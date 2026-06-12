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

// ============================================================
// 敌人配置与修饰器
// ============================================================

export type EnemyModifierType =
  | "immuneControl"        // 免疫石化/冻结/眩晕
  | "revive"               // 多命复活（倒下后复活至满血）
  | "damageReduction"      // 受到伤害 -N（可配置数值）
  | "damageBoost"          // 造成伤害 +N（可配置数值）
  | "innateTalent"         // 开局拥有自身的天赋
  | "fullEnergy"           // 开局满能量
  | "supportCard"          // 开局支援牌（场地/伙伴/道具/元素助佑）
  | "autoDish"             // 每回合自动生成料理
  | "innateArtifact";      // 开局圣遗物

/** 无参数的修饰器类型 */
type ModifierWithoutValue = "immuneControl" | "innateTalent" | "fullEnergy";
/** 数值参数的修饰器类型 */
type ModifierWithNumber = "revive" | "damageReduction" | "damageBoost" | "supportCard" | "autoDish" | "innateArtifact";

export type EnemyModifier =
  | { type: ModifierWithoutValue }
  | { type: ModifierWithNumber; value: number; value2?: number };

export interface EnemyConfig {
  characterId: number;
  /** 覆盖 HP（null 则使用默认公式计算） */
  hpOverride: number | null;
  /** 击败获得货币（null 则使用遭遇类型默认值） */
  currencyReward: number | null;
  /** 修饰器列表 */
  modifiers: EnemyModifier[];
  /** 锁定：关卡编辑器编辑时不会写回全局怪物池 */
  locked?: boolean;
}

export type EncounterType = "normal" | "elite" | "boss";

export interface Encounter {
  type: EncounterType;
  /** 敌人配置列表（一个遭遇可包含多个敌人） */
  configs: EnemyConfig[];
}

export interface Reward {
  cardId: number;
  name: string;
}

// ============================================================
// 事件系统
// ============================================================

/** 事件触发条件（可扩展的判别联合类型） */
export type EventConditionType =
  | { type: "hasCard"; cardId: number; minCount?: number }
  | { type: "hasAnyCards"; cardIds: number[] }
  | { type: "hasCharacterTag"; tag: string; minCount?: number }
  | { type: "hasCharacter"; characterId: number }
  | { type: "hasAllCharacters"; characterIds: number[] }
  | { type: "noCharacter"; characterId: number }
  | { type: "defeatedEnemy"; enemyId: number }
  | { type: "floorAtLeast"; floor: number }
  | { type: "currencyAtLeast"; amount: number }
  | { type: "deckSizeAtLeast"; count: number }
  | { type: "teamSizeAtLeast"; count: number }
  | { type: "teamSizeAtMost"; count: number }
  | { type: "teamOnlyElements"; elements: string[] }
  | { type: "anyEventCompleted"; eventIds: number[] }
  | { type: "noEventCompleted"; eventIds: number[] };

export interface EventCondition {
  condition: EventConditionType;
  /** 权重：满足条件时累加，总权重越高越容易被选中 */
  weight: number;
}

/** 事件效果（可扩展的判别联合类型） */
export type EventEffectType =
  | { type: "addCurrency"; amount: number }
  | { type: "removeCurrency"; amount: number }
  | { type: "addCard"; cardId: number; count?: number }
  | { type: "removeCard"; cardId: number; count?: number }
  | { type: "modifyCharacterMaxHp"; characterId?: number; amount: number }
  | { type: "addCharacter"; characterId: number }
  | { type: "modifyNextBattleAllyHp"; amount: number }
  | { type: "modifyNextBattleEnemyHp"; amount: number }
  | { type: "skipNextNormalBattle" }
  | { type: "chooseAndRemoveCard" }
  | { type: "randomCard"; tag: string; count?: number };

export interface EventDefinition {
  id: number;
  name: string;
  /** 横版剧情图 URL */
  imageUrl: string;
  /** 剧情文字模板（支持 {{variable}} 变量替换） */
  storyTemplate: string;
  /**
   * 条件匹配模式：
   * - "or"（默认）：任一条件满足即为候选，满足的条件权重累加决定优先级
   * - "and"：所有条件必须满足才为候选
   */
  conditionMode?: "and" | "or";
  /** 触发条件列表（权重用于多事件竞争选择） */
  conditions: EventCondition[];
  /** 事件效果列表 */
  effects: EventEffectType[];
}

// ============================================================

export type RunState =
  | "characterSelect"
  | "addCharacter"
  | "encounterSelect"
  | "battle"
  | "reward"
  | "shop"
  | "event"
  | "victory"
  | "gameOver";

export type NodeType = "normal" | "elite" | "shop" | "boss" | "event";

export interface PathNode {
  type: NodeType;
  encounters: Encounter[];
  completed: boolean;
  /** 固定事件 ID（仅 event 节点，resolveEvent 优先使用） */
  fixedEventId?: number;
}

export interface ShopItem {
  cardId: number;
  name: string;
  cost: number;
}

export interface CharacterPoolEntry {
  id: number;
  name: string;
  element: string;
  weapon: string;
}

export interface RoguelikeRun {
  state: RunState;
  floor: number;
  maxFloors: number;
  /** 当前层是否跳过角色选择（隐藏层） */
  floorSkipCharSelection: boolean;
  characters: number[];
  deck: number[];
  currency: number;
  path: PathNode[];
  currentNodeIndex: number;
  currentEncounter: Encounter | null;
  shopItems: ShopItem[];
  refreshCount: number;
  deleteCount: number;
  rewardItems: Reward[];
  availableCharacters: CharacterPoolEntry[];
  /** 本局已完成的事件 ID 列表 */
  completedEventIds: number[];
  /** 当前正在显示的事件 */
  currentEvent: EventDefinition | null;
  /** 下一场战斗我方全体 HP 修正 */
  nextBattleAllyHpModifier: number;
  /** 下一场战斗敌方全体 HP 修正 */
  nextBattleEnemyHpModifier: number;
  /** 角色最大生命修正值（charId → 修正量） */
  characterHpModifiers: Record<number, number>;

  /** 是否跳过下一个普通战斗节点（由事件效果 skipNextNormalBattle 设置） */
  skipNextNormalBattle: boolean;
  /** 是否需要选择删除卡牌（由事件效果 chooseAndRemoveCard 设置） */
  pendingChooseAndRemoveCard: boolean;
}

export interface FloorConfig {
  floor: number;
  path: NodeType[];
  /** 每个路径节点的敌人配置（null 表示从默认池随机） */
  encounters?: (EnemyConfig[][] | null)[];
  /** 事件节点的固定事件 ID 列表（与 path 中的 event 节点一一对应） */
  fixedEventIds?: (number | null)[];
}

export interface RoguelikeConfig {
  floors: FloorConfig[];
  initialCurrency: number;
  shopCardCount: number;
  rewardCardCount: number;
  interestThreshold: number;
  interestRate: number;
  /** 所有已定义的事件 */
  events: EventDefinition[];
}
