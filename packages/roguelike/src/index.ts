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
  DEFAULT_ENEMY_MODIFIERS, TENSHUKAKU_ENTITY_ID, DEFAULT_EVENTS, FALLBACK_EVENT_ID,
  // economy
  getEnemyHp, ENCOUNTER_CURRENCY, getEncounterCurrency,
  getRefreshCost, getDeleteCost, getInterest, SHOP_CARD_PRICE_MIN, SHOP_CARD_PRICE_MAX,
  // enemies
  ALL_NORMAL_ENEMIES, ALL_ELITE_ENEMIES, ALL_BOSS_ENEMIES, DEFAULT_ENEMY_POOL,
  validateEnemyIds,
  // enemy-modifiers
  KNOWN_STATUS_IDS, validateStatusIds,
} from "./data";
export {
  generateCharacterPool, rollCharacterChoices,
  generateInitialDeck, generateCharacterCards,
  createEncounter, generateFloorPath, getEncounterName, getEncounterCharacterIds,
  querySupportCards, queryFoodCards, queryArtifactCards,
} from "./pool";
export type { EnemyPool, CardEntry } from "./pool";
export { generateCardPool, rollCards, rollShopCards, validateCardIds, DEFAULT_SHOP_CARD_COST } from "./card-pool";
export type { RollCardsOptions } from "./card-pool";
export { getImageUrl, FALLBACK_IMAGE, getCardName, getCardDescription, sample, validateIds } from "./utils";
export { RoguelikeRunManager } from "./run";
export type { SimpleStorage } from "./run";
export { resolveModifier, resolveModifiers, makeEntityState } from "./modifier-resolver";
export type { ModifierEffect } from "./modifier-resolver";
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
export {
  CardRelationshipAnalyzer,
  defaultCardRelationshipAnalyzer,
  analyzeRelationships,
  getAllCharacters,
} from "./card-relationships";
export type { SuggestedPair } from "./card-relationships";
export {
  CONDITION_DESCRIPTORS,
  EFFECT_DESCRIPTORS,
} from "./event-descriptors";
export type { FieldDescriptor, ConditionDescriptor, EffectDescriptor } from "./event-descriptors";
