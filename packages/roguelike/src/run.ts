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

import { Game, type GameData, type DeckConfig, type GameState } from "@gi-tcg/core";
import { createSimpleAI } from "./ai";
import { generateInitialDeck, generateCharacterCards } from "./deck";
import { ROGUELIKE_CONFIG, MAX_TEAM_SIZE, CHARACTER_CHOICE_COUNT } from "./data";
import { getEnemyHp, getEncounterCurrency, getRefreshCost, getDeleteCost, getInterest } from "./economy";
import { rollShopCards, rollCards } from "./card-pool";
import { rollCharacterChoices, generateCharacterPool } from "./character-pool";
import { generateFloorPath, getEncounterCharacterIds, type EnemyPool } from "./floor-gen";
import { resolveModifiers } from "./modifier-resolver";
import { getEligibleEvents, selectEvent, applyEventEffects, renderEventText, getEffectDescription } from "./events";
import type {
  RoguelikeRun,
  RoguelikeConfig,
  Encounter,
  Reward,
  ShopItem,
  RunState,
  PathNode,
  CharacterPoolEntry,
  EventDefinition,
} from "./types";

export class RoguelikeRunManager {
  private run: RoguelikeRun;
  private data: GameData;
  private config: RoguelikeConfig;
  private enemyPool?: EnemyPool;
  private cardCosts?: Record<number, number>;
  private onUpdate: ((run: RoguelikeRun) => void) | null = null;
  private pendingFirstCharacter: number | null = null;
  /** 缓存的角色池（data 不变，只需构建一次） */
  private characterPool: CharacterPoolEntry[] | undefined;

  constructor(data: GameData, config: RoguelikeConfig = ROGUELIKE_CONFIG, enemyPool?: EnemyPool, cardCosts?: Record<number, number>) {
    this.data = data;
    this.config = config;
    this.enemyPool = enemyPool;
    this.cardCosts = cardCosts;
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
      availableCharacters: rollCharacterChoices(CHARACTER_CHOICE_COUNT, this.data, [], this.getCharacterPool()),
      completedEventIds: [],
      currentEvent: null,
      nextEnemyHpModifier: 0,
      characterHpModifiers: {},
      skipNextNode: false,
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
    this.run.availableCharacters = rollCharacterChoices(CHARACTER_CHOICE_COUNT, this.data, [characterId], this.getCharacterPool());
    this.notify();
  }

  selectSecondCharacter(characterId: number): void {
    if (this.pendingFirstCharacter === null) return;
    this.run.characters = [this.pendingFirstCharacter, characterId];

    const tagsList = this.getTagsList(this.run.characters);
    this.run.deck = generateInitialDeck(tagsList);

    this.pendingFirstCharacter = null;
    this.run.floor = 1;
    this.run.floorSkipCharSelection = false;
    this.run.path = this.generatePath(0);
    this.run.currentNodeIndex = 0;
    this.processCurrentNode();
  }

  /** 根据楼层索引生成路径（带 encounter 配置） */
  private generatePath(floorIndex: number): PathNode[] {
    const fc = this.config.floors[floorIndex];
    return generateFloorPath(fc.path, fc.encounters, this.enemyPool);
  }

  // ============================================================
  // 追加角色
  // ============================================================

  getAvailableCharactersForAdd(): typeof this.run.availableCharacters {
    return rollCharacterChoices(CHARACTER_CHOICE_COUNT, this.data, this.run.characters, this.getCharacterPool());
  }

  addCharacter(characterId: number): void {
    if (this.run.characters.length >= MAX_TEAM_SIZE) return;
    this.run.characters = [...this.run.characters, characterId];

    const char = this.data.characters.get(characterId);
    const tags = char?.tags.map(String) ?? [];
    this.run.deck = [...this.run.deck, ...generateCharacterCards(tags)];

    this.run.path = this.generatePath(this.run.floor - 1);
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
        // 满 4 人后自动跳过角色选择
        this.run.floorSkipCharSelection = this.run.characters.length >= MAX_TEAM_SIZE;
        if (this.run.floorSkipCharSelection) {
          this.run.path = this.generatePath(this.run.floor - 1);
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
        this.run.shopItems = rollShopCards(this.config.shopCardCount, { data: this.data, characterIds: this.run.characters, floor: this.run.floor, deck: this.run.deck, cardCosts: this.cardCosts });
        this.run.refreshCount = 0;
        this.setState("shop");
        break;
      case "event":
        this.resolveEvent();
        break;
      default:
        this.setState("encounterSelect");
        break;
    }
  }

  private getCurrentNode(): PathNode | null {
    return this.run.path[this.run.currentNodeIndex] ?? null;
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /** 评估并选择一个事件 */
  private resolveEvent(): void {
    const events = this.config.events ?? [];
    const eligible = getEligibleEvents(events, this.run, this.data);
    const selected = selectEvent(eligible);
    if (selected) {
      this.run.currentEvent = selected;
      this.setState("event");
    } else {
      // 没有满足条件的事件，直接跳过
      this.run.currentNodeIndex++;
      this.processCurrentNode();
    }
  }

  /** 确认事件效果并继续 */
  confirmEvent(): void {
    const event = this.run.currentEvent;
    if (!event) return;

    // 记录已完成事件
    this.run.completedEventIds = [...this.run.completedEventIds, event.id];

    // 应用效果
    applyEventEffects(event.effects, this.run, this.data);

    const node = this.getCurrentNode();
    if (node) node.completed = true;

    this.run.currentEvent = null;

    // 处理跳过下一个节点的效果
    if (this.run.skipNextNode) {
      this.run.skipNextNode = false;
      this.run.currentNodeIndex += 2; // 跳过当前 + 下一个
    } else {
      this.run.currentNodeIndex++;
    }
    this.processCurrentNode();
  }

  /** 渲染事件文本（带变量替换） */
  renderEventText(template: string): string {
    return renderEventText(template, this.run, this.data);
  }

  /** 获取事件效果描述列表 */
  getEventEffectDescriptions(event: EventDefinition): string[] {
    return event.effects.map((e) => getEffectDescription(e, this.data));
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
      // 支持每敌人自定义货币奖励
      const currencyReward = getEncounterCurrency(encounter);
      this.run.currency += currencyReward;
      this.run.currency += getInterest(this.run.currency, this.config.interestThreshold, this.config.interestRate);

      const node = this.getCurrentNode();
      if (node) node.completed = true;

      this.run.rewardItems = rollCards(this.config.rewardCardCount, { data: this.data, characterIds: this.run.characters, floor: this.run.floor, deck: this.run.deck });
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
      characters: getEncounterCharacterIds(encounter),
      cards: [],
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
    const configs = encounter.configs;
    const players = [...state.players] as any[];
    const hpModifier = this.consumeNextEnemyHpModifier();

    // 预解析所有 config 的 modifier（单次遍历）
    const resolved = configs.map((config) => ({
      config,
      ...resolveModifiers(config.modifiers, config.characterId, this.data),
    }));

    // 为每个敌人角色应用对应的 config
    const enemyPlayer = {
      ...players[1],
      characters: players[1].characters.map((char: any) => {
        const charId = char.definition?.id ?? char.id;
        const match = resolved.find((r) => r.config.characterId === charId) ?? resolved[0];

        const baseHp = match.config.hpOverride ?? getEnemyHp(this.run.floor, encounter.type);
        const targetHp = Math.max(1, baseHp + hpModifier);

        const newVars: any = {
          ...char.variables,
          health: targetHp,
          maxHealth: targetHp,
        };
        if (match.hasFullEnergy) {
          const energyVarName = (char.definition as any)?.specialEnergy?.variableName ?? "energy";
          const maxEnergy = char.variables.maxEnergy ?? 2;
          newVars[energyVarName] = maxEnergy;
        }
        return {
          ...char,
          variables: newVars,
          entities: [...char.entities, ...match.statusEntities],
        };
      }),
      supports: [...players[1].supports, ...resolved.flatMap((r) => r.supportEntities)],
      hand: [...(players[1].hand ?? []), ...resolved.flatMap((r) => r.handCardIds)],
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
    this.run.shopItems = rollShopCards(this.config.shopCardCount, { data: this.data, characterIds: this.run.characters, floor: this.run.floor, deck: this.run.deck, cardCosts: this.cardCosts });
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

  /** 获取当前运行中的事件 HP 修正 */
  getCharacterHpModifier(characterId: number): number {
    return this.run.characterHpModifiers[characterId] ?? 0;
  }

  /** 获取敌人 HP 修正值并重置 */
  consumeNextEnemyHpModifier(): number {
    const mod = this.run.nextEnemyHpModifier;
    this.run.nextEnemyHpModifier = 0;
    return mod;
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
    this.run.path = this.generatePath(0);
    this.run.currentNodeIndex = 0;
    this.run.availableCharacters = rollCharacterChoices(CHARACTER_CHOICE_COUNT, this.data, characterIds, this.getCharacterPool());
    this.setState("encounterSelect");
  }

  /** 调试：直接应用一个事件的效果（用于事件测试面板） */
  debugApplyEvent(event: EventDefinition): void {
    applyEventEffects(event.effects, this.run, this.data);
    if (!this.run.completedEventIds.includes(event.id)) {
      this.run.completedEventIds = [...this.run.completedEventIds, event.id];
    }
    this.notify();
  }
}
