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
  Reward,
  RunState,
  NodeType,
  PathNode,
  RoguelikeRun,
  ShopItem,
  FloorConfig,
  RoguelikeConfig,
  CharacterPoolEntry,
} from "./types";
export type { RollCardsOptions } from "./encounters";
export { RoguelikeRunManager } from "./run";
export {
  ROGUELIKE_CONFIG,
  generateCharacterPool,
  NORMAL_ENCOUNTERS,
  ELITE_ENCOUNTERS,
  BOSS_ENCOUNTERS,
  generateInitialDeck,
  generateCharacterCards,
  generateCardPool,
  getEnemyHp,
  BOSS_PHASE_HP,
  ENCOUNTER_CURRENCY,
  getRefreshCost,
  getDeleteCost,
  getInterest,
  rollShopCards,
  rollCards,
  rollCharacterChoices,
  generateFloorPath,
  getImageUrl,
  FALLBACK_IMAGE,
  getCardName,
  SHOP_CARD_PRICE_MIN,
  SHOP_CARD_PRICE_MAX,
} from "./encounters";
export {
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
  analyzeRelationships,
  getAllCharacters,
} from "./card-relationships";
export type { SuggestedPair } from "./card-relationships";
