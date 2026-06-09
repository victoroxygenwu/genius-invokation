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

import { Game, type GameData, type DeckConfig, type GameState, StateSymbol } from "@gi-tcg/core";
import { createSimpleAI } from "./ai";
import {
  generateInitialDeck,
  generateCharacterCards,
  getEnemyHp,
  ROGUELIKE_CONFIG,
  ENCOUNTER_CURRENCY,
  getRefreshCost,
  getDeleteCost,
  getInterest,
  rollShopCards,
  rollCards,
  rollCharacterChoices,
  generateFloorPath,
  generateCharacterPool,
} from "./encounters";
import type {
  RoguelikeRun,
  RoguelikeConfig,
  Encounter,
  Reward,
  ShopItem,
  RunState,
  PathNode,
  CharacterPoolEntry,
} from "./types";

export class RoguelikeRunManager {
  private run: RoguelikeRun;
  private data: GameData;
  private config: RoguelikeConfig;
  private onUpdate: ((run: RoguelikeRun) => void) | null = null;
  private pendingFirstCharacter: number | null = null;
  /** 缓存的角色池（data 不变，只需构建一次） */
  private characterPool: CharacterPoolEntry[] | undefined;

  constructor(data: GameData, config: RoguelikeConfig = ROGUELIKE_CONFIG) {
    this.data = data;
    this.config = config;
    this.run = this.createInitialRun();
  }

  private getCharacterPool(): CharacterPoolEntry[] {
    if (!this.characterPool) {
      this.characterPool = generateCharacterPool(this.data);
    }
    return this.characterPool;
  }

  /** 从角色 ID 列表提取标签列表 */
  private getTagsList(ids: number[]): string[][] {
    return ids.map((id) => {
      const char = this.data.characters.get(id);
      return char?.tags.map(String) ?? [];
    });
  }

  private createInitialRun(): RoguelikeRun {
    return {
      state: "characterSelect",
      floor: 0,
      maxFloors: this.config.floors.length,
      floorSkipCharSelection: false,
      characters: [],
      deck: [],
      currency: this.config.initialCurrency,
      path: [],
      currentNodeIndex: 0,
      currentEncounter: null,
      shopItems: [],
      refreshCount: 0,
      deleteCount: 0,
      rewardItems: [],
      availableCharacters: rollCharacterChoices(4, this.data, [], this.getCharacterPool()),
    };
  }

  setOnUpdate(callback: (run: RoguelikeRun) => void): void {
    this.onUpdate = callback;
  }

  getRun(): Readonly<RoguelikeRun> {
    return this.run;
  }

  private notify(): void {
    // 创建新引用以触发 SolidJS 响应式更新
    this.onUpdate?.({ ...this.run });
  }

  private setState(state: RunState): void {
    this.run.state = state;
    this.notify();
  }

  // ============================================================
  // 开局选 2 个角色
  // ============================================================

  selectFirstCharacter(characterId: number): void {
    this.pendingFirstCharacter = characterId;
    this.run.availableCharacters = rollCharacterChoices(4, this.data, [characterId], this.getCharacterPool());
    this.notify();
  }

  selectSecondCharacter(characterId: number): void {
    if (this.pendingFirstCharacter === null) return;
    this.run.characters = [this.pendingFirstCharacter, characterId];

    const tagsList = this.getTagsList(this.run.characters);
    this.run.deck = generateInitialDeck(tagsList);

    this.pendingFirstCharacter = null;
    this.run.floor = 1;
    this.run.floorSkipCharSelection = this.config.floors[0]?.skipCharacterSelection ?? false;
    this.run.path = generateFloorPath(this.config.floors[0].path);
    this.run.currentNodeIndex = 0;
    this.processCurrentNode();
  }

  // ============================================================
  // 追加角色
  // ============================================================

  getAvailableCharactersForAdd(): typeof this.run.availableCharacters {
    return rollCharacterChoices(4, this.data, this.run.characters, this.getCharacterPool());
  }

  addCharacter(characterId: number): void {
    if (this.run.characters.length >= 4) return;
    this.run.characters = [...this.run.characters, characterId];

    const char = this.data.characters.get(characterId);
    const tags = char?.tags.map(String) ?? [];
    this.run.deck = [...this.run.deck, ...generateCharacterCards(tags)];

    this.run.path = generateFloorPath(this.config.floors[this.run.floor - 1].path);
    this.run.currentNodeIndex = 0;
    this.processCurrentNode();
  }

  // ============================================================
  // 层与路线
  // ============================================================

  private processCurrentNode(): void {
    const node = this.getCurrentNode();
    if (!node) {
      if (this.run.floor < this.run.maxFloors) {
        this.run.floor++;
        const nextFloorConfig = this.config.floors[this.run.floor - 1];
        this.run.floorSkipCharSelection = nextFloorConfig?.skipCharacterSelection ?? false;
        if (this.run.floorSkipCharSelection) {
          // 隐藏层：跳过角色选择，直接生成路径并开始
          this.run.path = generateFloorPath(nextFloorConfig.path);
          this.run.currentNodeIndex = 0;
          this.processCurrentNode();
          return;
        }
        this.run.availableCharacters = this.getAvailableCharactersForAdd();
        this.setState("addCharacter");
      } else {
        this.setState("victory");
      }
      return;
    }

    switch (node.type) {
      case "shop":
        this.run.shopItems = rollShopCards(this.config.shopCardCount, { data: this.data, characterIds: this.run.characters, floor: this.run.floor, deckCards: this.run.deck });
        this.run.refreshCount = 0;
        this.setState("shop");
        break;
      default:
        this.setState("encounterSelect");
        break;
    }
  }

  private getCurrentNode(): PathNode | null {
    return this.run.path[this.run.currentNodeIndex] ?? null;
  }

  getAvailableEncounters(): Encounter[] {
    return this.getCurrentNode()?.encounters ?? [];
  }

  // ============================================================
  // 遭遇与战斗
  // ============================================================

  selectEncounter(encounterIndex: number): void {
    const node = this.getCurrentNode();
    if (!node) return;
    const encounter = node.encounters[encounterIndex];
    if (!encounter) return;
    this.run.currentEncounter = encounter;
    this.setState("battle");
  }

  onBattleEnd(winner: 0 | 1): void {
    const encounter = this.run.currentEncounter;
    if (!encounter) return;

    if (winner === 0) {
      this.run.currency += ENCOUNTER_CURRENCY[encounter.type] ?? 0;
      this.run.currency += getInterest(this.run.currency, this.config.interestThreshold, this.config.interestRate);

      const node = this.getCurrentNode();
      if (node) node.completed = true;

      this.run.rewardItems = rollCards(this.config.rewardCardCount, { data: this.data, characterIds: this.run.characters, floor: this.run.floor, deckCards: this.run.deck });
      this.setState("reward");
    } else {
      this.setState("gameOver");
    }
  }

  createBattleGame(encounter: Encounter): { game: Game; playerWho: 0 } {
    const playerDeck: DeckConfig = {
      characters: this.run.characters,
      cards: this.run.deck,
      noShuffle: false,
    };
    const enemyDeck: DeckConfig = {
      characters: encounter.script.characters,
      cards: encounter.script.cards,
      noShuffle: true,
    };

    let state = Game.createInitialState({
      decks: [playerDeck, enemyDeck],
      data: this.data,
    });
    state = this.prepareEnemyState(state, encounter);

    const game = new Game(state);
    game.players[1].io = createSimpleAI(this.data);
    game.players[1].config.alwaysOmni = true;
    game.onPause = async () => {};

    return { game, playerWho: 0 };
  }

  private prepareEnemyState(state: GameState, encounter: Encounter): GameState {
    const targetHp = getEnemyHp(this.run.floor, encounter.type);
    // 天守阁场地牌：为 AI 提供 9 个万能骰
    const TENSHUKAKU_ENTITY_ID = 321007;
    const TENSHUKAKU_SUPPORT_ID = 88890;
    const tenshukakuDef = this.data.entities.get(TENSHUKAKU_ENTITY_ID);

    const players = [...state.players] as any[];
    const enemyPlayer = {
      ...players[1],
      characters: players[1].characters.map((char: any) => ({
        ...char,
        variables: { ...char.variables, health: targetHp, maxHealth: targetHp },
      })),
      supports: tenshukakuDef ? [{
        [StateSymbol]: "entity",
        id: TENSHUKAKU_SUPPORT_ID,
        definition: tenshukakuDef,
        variables: {},
        attachments: [],
      }] : [],
    };
    players[1] = enemyPlayer;
    return { ...state, players: players as unknown as typeof state.players };
  }

  // ============================================================
  // 奖励
  // ============================================================

  getRewards(): Reward[] {
    return this.run.rewardItems;
  }

  claimRewardAndFinish(rewardIndex: number): void {
    const reward = this.run.rewardItems[rewardIndex];
    if (reward) {
      this.run.deck = [...this.run.deck, reward.cardId];
    }
    this.run.rewardItems = [];
    this.run.currentEncounter = null;
    this.run.currentNodeIndex++;
    this.processCurrentNode();
  }

  // ============================================================
  // 商店
  // ============================================================

  getShopItems(): ShopItem[] { return this.run.shopItems; }
  getRefreshCost(): number { return getRefreshCost(this.run.refreshCount); }
  getDeleteCost(): number { return getDeleteCost(this.run.deleteCount); }

  refreshShop(): boolean {
    const cost = this.getRefreshCost();
    if (this.run.currency < cost) return false;
    this.run.currency -= cost;
    this.run.refreshCount++;
    this.run.shopItems = rollShopCards(this.config.shopCardCount, { data: this.data, characterIds: this.run.characters, floor: this.run.floor, deckCards: this.run.deck });
    this.notify();
    return true;
  }

  buyCard(index: number): boolean {
    const item = this.run.shopItems[index];
    if (!item || this.run.currency < item.cost) return false;
    this.run.currency -= item.cost;
    this.run.deck.push(item.cardId);
    // 创建新数组以触发 SolidJS 响应式更新
    this.run.shopItems = this.run.shopItems.filter((_, i) => i !== index);
    this.notify();
    return true;
  }

  deleteCard(deckIndex: number): boolean {
    const cost = this.getDeleteCost();
    if (this.run.currency < cost) return false;
    if (deckIndex < 0 || deckIndex >= this.run.deck.length) return false;
    this.run.currency -= cost;
    // 创建新数组以触发 SolidJS 响应式更新
    this.run.deck = this.run.deck.filter((_, i) => i !== deckIndex);
    this.run.deleteCount++;
    this.notify();
    return true;
  }

  finishShop(): void {
    this.run.shopItems = [];
    this.run.refreshCount = 0;
    this.run.currentNodeIndex++;
    this.processCurrentNode();
  }

  restart(): void {
    this.pendingFirstCharacter = null;
    this.run = this.createInitialRun();
    this.notify();
  }

  // ============================================================
  // 调试方法
  // ============================================================

  /** 直接设置运行状态（用于测试面板跳转） */
  debugSetRun(partial: Partial<RoguelikeRun>): void {
    Object.assign(this.run, partial);
    this.notify();
  }

  /** 用指定角色和货币初始化 run 并进入 encounterSelect 状态 */
  debugQuickStart(characterIds: number[], currency: number): void {
    const tagsList = this.getTagsList(characterIds);
    this.run.characters = characterIds;
    this.run.deck = generateInitialDeck(tagsList);
    this.run.currency = currency;
    this.run.floor = 1;
    this.run.path = generateFloorPath(this.config.floors[0].path);
    this.run.currentNodeIndex = 0;
    this.run.availableCharacters = rollCharacterChoices(4, this.data, characterIds, this.getCharacterPool());
    this.setState("encounterSelect");
  }
}
