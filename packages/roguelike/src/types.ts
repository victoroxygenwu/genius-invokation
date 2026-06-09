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

export type ScriptedAction =
  | { type: "useSkill"; skillId: number }
  | { type: "playCard"; cardIndex: number }
  | { type: "switchActive"; targetId: number }
  | { type: "elementalTuning" }
  | { type: "declareEnd" };

export interface BehaviorRule {
  actions: ScriptedAction[];
}

export interface CharacterBehavior {
  characterDefinitionId: number;
  rules: BehaviorRule[];
}

export interface EnemyScript {
  name: string;
  characters: number[];
  cards: number[];
  behaviors: CharacterBehavior[];
}

export type EncounterType = "normal" | "elite" | "boss";

export interface Encounter {
  type: EncounterType;
  script: EnemyScript;
}

export interface Reward {
  cardId: number;
  name: string;
}

export type RunState =
  | "characterSelect"
  | "addCharacter"
  | "encounterSelect"
  | "battle"
  | "reward"
  | "shop"
  | "victory"
  | "gameOver";

export type NodeType = "normal" | "elite" | "shop" | "boss";

export interface PathNode {
  type: NodeType;
  encounters: Encounter[];
  completed: boolean;
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
}

export interface FloorConfig {
  floor: number;
  path: NodeType[];
  /** 跳过角色选择，直接进入路径（如仅Boss的隐藏关卡） */
  skipCharacterSelection?: boolean;
}

export interface RoguelikeConfig {
  floors: FloorConfig[];
  initialCurrency: number;
  shopCardCount: number;
  rewardCardCount: number;
  interestThreshold: number;
  interestRate: number;
}
