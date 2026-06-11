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

export { createSimpleAI } from "./ai";
export type {
  ScriptedAction,
  BehaviorRule,
  CharacterBehavior,
  EnemyScript,
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
export {
  ROGUELIKE_CONFIG,
  MAX_TEAM_SIZE, CHARACTER_CHOICE_COUNT, SHOP_COST_GROWTH_RATE,
  BASE_HP,
} from "./data";
export { generateCharacterPool, rollCharacterChoices } from "./character-pool";
export { generateInitialDeck, generateCharacterCards } from "./deck";
export { generateCardPool, rollCards, rollShopCards, validateCardIds, DEFAULT_SHOP_CARD_COST } from "./card-pool";
export type { RollCardsOptions } from "./card-pool";
export {
  getEnemyHp, BOSS_PHASE_HP, ENCOUNTER_CURRENCY, getEncounterCurrency,
  getRefreshCost, getDeleteCost, getInterest, SHOP_CARD_PRICE_MIN, SHOP_CARD_PRICE_MAX,
} from "./economy";
export { getImageUrl, FALLBACK_IMAGE, getCardName, sample, validateIds } from "./utils";
export { enemyConfigToScript, createEncounter, generateFloorPath, getEncounterName, getEncounterCharacterIds } from "./floor-gen";
export type { EnemyPool } from "./floor-gen";
export { querySupportCards, queryFoodCards, queryArtifactCards } from "./card-queries";
export type { CardEntry } from "./card-queries";
export { RoguelikeRunManager } from "./run";
export {
  ALL_NORMAL_ENEMIES,
  ALL_ELITE_ENEMIES,
  ALL_BOSS_ENEMIES,
  DEFAULT_ENEMY_POOL,
  validateEnemyIds,
} from "./enemies";
export { KNOWN_STATUS_IDS, validateStatusIds } from "./enemy-modifiers";
export { resolveModifier, resolveModifiers, makeEntityState } from "./modifier-resolver";
export type { ModifierEffect } from "./modifier-resolver";
export { DEFAULT_ENEMY_MODIFIERS, TENSHUKAKU_ENTITY_ID, DEFAULT_EVENTS } from "./data";
export {
  evaluateEventWeight,
  getEligibleEvents,
  selectEvent,
  renderEventText,
  applyEventEffects,
  getEffectDescription,
  getConditionDescription,
} from "./events";
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
export type { CardWeightPair, CardWeightConfig } from "./card-weights";
export {
  CardRelationshipAnalyzer,
  defaultCardRelationshipAnalyzer,
  analyzeRelationships,
  getAllCharacters,
} from "./card-relationships";
export type { SuggestedPair } from "./card-relationships";
