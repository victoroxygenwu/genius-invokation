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

/**
 * @gi-tcg/roguelike — Roguelike（肉鸽）模式核心逻辑包。
 *
 * 模块导出结构：
 * - **types** — 运行状态、敌人配置、事件定义等核心类型
 * - **data** — 常量配置（经济系统、敌人池、默认事件、验证函数）
 * - **pool** — 角色池生成、初始卡组、遭遇创建、楼层路径
 * - **card-pool** — 可用卡池生成与加权随机抽取
 * - **events** — 事件条件评估、选择、效果应用与文本渲染
 * - **card-weights** — 卡牌关联权重管理（含多源扩散算法）
 * - **card-relationships** — 基于标签和描述的卡牌关系自动分析（含多源扩散和文本语料分析）
 * - **modifier-resolver** — 敌人修饰器解析（状态、支援牌、标记）
 * - **run** — RoguelikeRunManager 运行管理器（状态机、存档、战斗）
 * - **ai** — 敌人简单优先级 AI
 * - **utils** — 图片 URL、名称查询、采样工具
 */

// ============================================================
// AI
// ============================================================

export { createSimpleAI } from "./ai";

// ============================================================
// 类型定义
// ============================================================

export type {
  EncounterType,
  Encounter,
  EnemyModifierType,
  EnemyModifier,
  EnemyConfig,
  Reward,
  RunState,
  NodeType,
  PathNode,
  RoguelikeRun,
  ShopItem,
  FloorConfig,
  RoguelikeConfig,
  CharacterPoolEntry,
  EventConditionType,
  EventCondition,
  EventEffectType,
  EventDefinition,
} from "./types";

// ============================================================
// 常量配置与验证
// ============================================================

export {
  ROGUELIKE_CONFIG,
  MAX_TEAM_SIZE, CHARACTER_CHOICE_COUNT, SHOP_COST_GROWTH_RATE,
  BASE_HP,
  DEFAULT_ENEMY_MODIFIERS, TENSHUKAKU_ENTITY_ID, DEFAULT_EVENTS, FALLBACK_EVENT_IDS,
  // economy
  getEnemyHp, ENCOUNTER_CURRENCY, getEncounterCurrency,
  getRefreshCost, getDeleteCost, getInterest, SHOP_CARD_PRICE_MIN, SHOP_CARD_PRICE_MAX,
  // enemies
  ALL_NORMAL_ENEMIES, ALL_ELITE_ENEMIES, ALL_BOSS_ENEMIES, DEFAULT_ENEMY_POOL,
  validateEnemyIds,
  // enemy-modifiers
  KNOWN_STATUS_IDS, validateStatusIds,
} from "./data";

// ============================================================
// 角色池、初始卡组与遭遇
// ============================================================

export {
  generateCharacterPool, rollCharacterChoices,
  generateInitialDeck, generateCharacterCards,
  createEncounter, generateFloorPath, getEncounterName, getEncounterCharacterIds,
  querySupportCards, queryFoodCards, queryArtifactCards,
} from "./pool";
export type { EnemyPool, CardEntry } from "./pool";

// ============================================================
// 卡池生成与加权抽取
// ============================================================

export { generateCardPool, rollCards, rollShopCards, validateCardIds, DEFAULT_SHOP_CARD_COST } from "./card-pool";
export type { RollCardsOptions } from "./card-pool";

// ============================================================
// 工具函数
// ============================================================

export { getImageUrl, FALLBACK_IMAGE, getCardName, getCardDescription, sample, validateIds } from "./utils";

// ============================================================
// 运行管理器
// ============================================================

export { RoguelikeRunManager } from "./run";
export type { SimpleStorage } from "./run";

// ============================================================
// 敌人修饰器解析
// ============================================================

export { resolveModifier, resolveModifiers, makeEntityState } from "./modifier-resolver";
export type { ModifierEffect } from "./modifier-resolver";

// ============================================================
// 事件系统
// ============================================================

export {
  evaluateEventWeight,
  getEligibleEvents,
  selectEvent,
  renderEventText,
  applyEventEffects,
  getEffectDescription,
  getConditionDescription,
  CARD_TAG_LABELS,
} from "./events";

// ============================================================
// 卡牌关联权重
// ============================================================

export {
  CardWeightManager,
  defaultCardWeightManager,
  getCardWeight,
  getDirectCardWeight,
  setCardWeight,
  getAllWeightPairs,
  getRelatedCards,
  computeCardWeights,
  pairKey,
  clearAllWeights,
  loadPairs,
  snapWeight,
} from "./card-weights";
export type { CardWeightPair, CardWeightConfig, CardWeightStorageAdapter } from "./card-weights";

// ============================================================
// 卡牌关系分析
// ============================================================

export {
  CardRelationshipAnalyzer,
  defaultCardRelationshipAnalyzer,
  analyzeRelationships,
  getAllCharacters,
  getFullCardPool,
} from "./card-relationships";
export type { SuggestedPair } from "./card-relationships";

