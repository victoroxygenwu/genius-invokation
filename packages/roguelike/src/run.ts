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
import { ROGUELIKE_CONFIG, MAX_TEAM_SIZE, CHARACTER_CHOICE_COUNT, DEFAULT_EVENTS, FALLBACK_EVENT_ID } from "./data";
import { getEnemyHp, getEncounterCurrency, getRefreshCost, getDeleteCost, getInterest } from "./data";
import { rollShopCards, rollCards } from "./card-pool";
import { generateInitialDeck, generateCharacterCards, rollCharacterChoices, generateCharacterPool, generateFloorPath, getEncounterCharacterIds, type EnemyPool } from "./pool";
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

/** 简单存储接口（注入存档能力） */
export interface SimpleStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/** 可序列化的运行状态快照（排除不可序列化的字段） */
type RunSnapshot = Omit<RoguelikeRun, "currentEvent" | "currentEncounter">;

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
  /** 调试事件确认后的回调（通过 options 注入） */
  private onEventConfirm: (() => void) | null = null;
  /** 存档存储 */
  private storage: SimpleStorage | null = null;
  private saveKey: string | null = null;
  /** 自动存档开关（防止初始化/重启时写入无用存档） */
  private autoSaveEnabled = false;

  constructor(data: GameData, config: RoguelikeConfig = ROGUELIKE_CONFIG, enemyPool?: EnemyPool, cardCosts?: Record<number, number>, options?: { storage?: SimpleStorage; saveKey?: string; onEventConfirm?: () => void }) {
    this.data = data;
    this.config = config;
    this.enemyPool = enemyPool;
    this.cardCosts = cardCosts;
    this.storage = options?.storage ?? null;
    this.saveKey = options?.saveKey ?? null;
    this.onEventConfirm = options?.onEventConfirm ?? null;
    this.run = this.createInitialRun();
    // 同步存储直接加载；异步存储需后续调用 ready()
    if (this.storage && this.saveKey) {
      const result = this.loadSave();
      if (typeof result === "boolean" && result) {
        this.autoSaveEnabled = true;
      }
    }
  }

  /** 等待异步存储就绪后加载存档 */
  async ready(): Promise<boolean> {
    if (!this.storage || !this.saveKey) return false;
    const result = await this.loadSave();
    if (result) {
      this.autoSaveEnabled = true;
      this.notify();
    }
    return result;
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
      nextBattleAllyHpModifier: 0,
      nextBattleEnemyHpModifier: 0,
      characterHpModifiers: {},
      skipNextNormalBattle: false,
      pendingChooseAndRemoveCard: false,
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
    // 自动存档
    if (this.autoSaveEnabled) this.persistRun();
  }

  // ============================================================
  // 存档系统
  // ============================================================

  private static readonly SNAPSHOT_REPLACER = (key: string, value: unknown) =>
    key === "currentEvent" || key === "currentEncounter" ? undefined : value;

  /** 从快照恢复运行状态 */
  private fromSnapshot(snap: RunSnapshot): void {
    Object.assign(this.run, snap);
    this.run.currentEncounter = null;
    this.run.currentEvent = null;
  }

  /** 保存当前状态到存储 */
  save(): void | Promise<void> {
    this.persistRun();
  }

  /** 序列化并持久化当前运行状态 */
  private persistRun(): void | Promise<void> {
    if (!this.storage || !this.saveKey) return;
    try {
      const result = this.storage.setItem(
        this.saveKey,
        JSON.stringify(this.run, RoguelikeRunManager.SNAPSHOT_REPLACER),
      );
      if (result instanceof Promise) result.catch(() => {});
    } catch { /* quota exceeded */ }
  }

  /** 从存储加载存档，返回是否成功（支持异步存储） */
  private loadSave(): boolean | Promise<boolean> {
    if (!this.storage || !this.saveKey) return false;
    try {
      const raw = this.storage.getItem(this.saveKey);
      if (raw instanceof Promise) {
        return raw.then((r) => this.processLoadedSave(r));
      }
      return this.processLoadedSave(raw);
    } catch { return false; }
  }

  /** 校验快照是否为可恢复的有效存档 */
  private static isValidSaveSnapshot(snap: RunSnapshot | null): boolean {
    return typeof snap?.floor === "number" &&
      Array.isArray(snap?.characters) && snap.characters.length > 0 &&
      snap.state !== "victory" && snap.state !== "gameOver" && snap.state !== "characterSelect";
  }

  /** 解析并校验 JSON 字符串是否为有效存档 */
  private static parseAndValidate(raw: string | null): boolean {
    if (!raw) return false;
    try { return RoguelikeRunManager.isValidSaveSnapshot(JSON.parse(raw)); } catch { return false; }
  }

  private processLoadedSave(raw: string | null): boolean {
    if (!RoguelikeRunManager.parseAndValidate(raw)) {
      if (raw) this.clearSave();
      return false;
    }
    this.fromSnapshot(JSON.parse(raw!) as RunSnapshot);
    return true;
  }

  /** 清除存档 */
  clearSave(): void {
    if (this.storage && this.saveKey) {
      const result = this.storage.removeItem(this.saveKey);
      if (result instanceof Promise) result.catch(() => {});
    }
  }

  /** 是否有可用存档 */
  static hasSave(storage: SimpleStorage, saveKey: string): boolean | Promise<boolean> {
    try {
      const raw = storage.getItem(saveKey);
      if (raw instanceof Promise) {
        return raw.then((r) => RoguelikeRunManager.parseAndValidate(r));
      }
      return RoguelikeRunManager.parseAndValidate(raw);
    } catch { return false; }
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
    this.autoSaveEnabled = true;
    this.processCurrentNode();
  }

  /** 根据楼层索引生成路径（带 encounter 配置） */
  private generatePath(floorIndex: number): PathNode[] {
    const fc = this.config.floors[floorIndex];
    return generateFloorPath(fc.path, fc.encounters, this.enemyPool, fc.fixedEventIds);
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
        this.autoSaveEnabled = false;
        this.clearSave();
      }
      return;
    }

    // 处理跳过下一个普通战斗节点
    if (this.run.skipNextNormalBattle && node.type === "normal") {
      this.run.skipNextNormalBattle = false;
      node.completed = true;
      this.run.currentNodeIndex++;
      this.processCurrentNode();
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
    const node = this.getCurrentNode();

    // 节点有固定事件 ID 时优先使用
    if (node?.fixedEventId) {
      // 先在当前事件列表中查找，找不到则回退到 DEFAULT_EVENTS
      const fixed = events.find((e) => e.id === node.fixedEventId)
        ?? DEFAULT_EVENTS.find((e) => e.id === node.fixedEventId);
      if (fixed && !this.run.completedEventIds.includes(node.fixedEventId)) {
        this.run.currentEvent = fixed;
        this.setState("event");
        return;
      }
    }

    const eligible = getEligibleEvents(events, this.run, this.data);
    const selected = selectEvent(eligible);
    if (selected) {
      this.run.currentEvent = selected;
      this.setState("event");
    } else {
      // 没有满足条件的事件，使用回退事件
      const allEvents = events.length > 0 ? events : DEFAULT_EVENTS;
      const fallback = allEvents.find((e) => e.id === FALLBACK_EVENT_ID)
        ?? DEFAULT_EVENTS.find((e) => e.id === FALLBACK_EVENT_ID)!;
      this.run.currentEvent = { ...fallback };
      this.setState("event");
    }
  }

  /** 确认事件效果并继续。返回 true 表示是调试事件测试（调用者应返回编辑器） */
  confirmEvent(): boolean {
    const event = this.run.currentEvent;
    if (!event) return false;

    // 记录已完成事件
    this.run.completedEventIds = [...this.run.completedEventIds, event.id];

    // 应用效果（排除 chooseAndRemoveCard，它已在事件确认前由玩家手动处理）
    const effectsToApply = event.effects.filter((e) => e.type !== "chooseAndRemoveCard");
    applyEventEffects(effectsToApply, this.run, this.data);

    const node = this.getCurrentNode();
    if (node) node.completed = true;

    this.run.currentEvent = null;

    // 调试事件：确认后不继续推进，执行回调
    if (this.onEventConfirm) {
      const cb = this.onEventConfirm;
      this.onEventConfirm = null;
      this.notify();
      cb();
      return true;
    }

    this.run.currentNodeIndex++;
    this.processCurrentNode();
    return false;
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
      this.autoSaveEnabled = false;
      this.clearSave();
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
    state = this.prepareAllyState(state);

    const game = new Game(state);
    game.players[1].io = createSimpleAI(this.data);
    game.players[1].config.alwaysOmni = true;
    game.onPause = async () => {};

    return { game, playerWho: 0 };
  }

  /** 对指定玩家的角色 HP 应用映射函数，返回新 state */
  private applyPlayerHpModifier(
    state: GameState,
    playerIndex: number,
    mapChar: (char: any) => any,
    mapExtra?: (player: any) => Partial<any>,
  ): GameState {
    const players = [...state.players] as any[];
    const updated = {
      ...players[playerIndex],
      characters: players[playerIndex].characters.map(mapChar),
      ...mapExtra?.(players[playerIndex]),
    };
    players[playerIndex] = updated;
    return { ...state, players: players as unknown as typeof state.players };
  }

  private prepareEnemyState(state: GameState, encounter: Encounter): GameState {
    const configs = encounter.configs;
    const enemyHpModifier = this.run.nextBattleEnemyHpModifier;
    this.run.nextBattleEnemyHpModifier = 0;

    // 预解析所有 config 的 modifier（使用偏移量避免多敌人 ID 冲突）
    const resolved = configs.map((config, i) => ({
      config,
      ...resolveModifiers(config.modifiers, config.characterId, this.data, -i * 1000, -i * 1000),
    }));

    return this.applyPlayerHpModifier(state, 1, (char: any) => {
      const charId = char.definition?.id ?? char.id;
      const match = resolved.find((r) => r.config.characterId === charId) ?? resolved[0];

      const baseHp = match.config.hpOverride ?? getEnemyHp(this.run.floor, encounter.type);
      const targetHp = Math.max(1, baseHp + enemyHpModifier);

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
    }, (player) => ({
      supports: [...player.supports, ...resolved.flatMap((r) => r.supportEntities)],
      hand: [...(player.hand ?? []), ...resolved.flatMap((r) => r.handCardIds)],
    }));
  }

  private prepareAllyState(state: GameState): GameState {
    const allyHpModifier = this.run.nextBattleAllyHpModifier;
    if (allyHpModifier === 0) return state;
    this.run.nextBattleAllyHpModifier = 0;

    return this.applyPlayerHpModifier(state, 0, (char: any) => {
      const currentHp = char.variables.health ?? 10;
      const maxHp = char.variables.maxHealth ?? 10;
      const newHp = Math.max(1, currentHp + allyHpModifier);
      const newMaxHp = Math.max(maxHp, newHp);
      return {
        ...char,
        variables: { ...char.variables, health: newHp, maxHealth: newMaxHp },
      };
    });
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
    this.autoSaveEnabled = false;
    this.clearSave();
    this.run = this.createInitialRun();
    this.notify();
  }

  /** 获取当前运行中的事件 HP 修正 */
  getCharacterHpModifier(characterId: number): number {
    return this.run.characterHpModifiers[characterId] ?? 0;
  }

  /** 事件删除卡牌：不扣费、不计入全局删除次数 */
  eventRemoveCard(deckIndex: number): boolean {
    if (deckIndex < 0 || deckIndex >= this.run.deck.length) return false;
    this.run.deck.splice(deckIndex, 1);
    this.run.pendingChooseAndRemoveCard = false;
    this.notify();
    return true;
  }

  // ============================================================
  // 调试方法
  // ============================================================

  /** 判断当前状态是否可以暂离存档 */
  static canSave(run: RoguelikeRun): boolean {
    // 战斗中、通关、失败不可存档
    return run.state !== "battle" && run.state !== "victory" && run.state !== "gameOver";
  }

  /** 直接设置运行状态（用于测试面板跳转） */
  /** @internal 调试用：覆盖运行状态 */
  setRun(partial: Partial<RoguelikeRun>): void {
    Object.assign(this.run, partial);
    this.notify();
  }

  /** @internal 调试用：用指定角色和货币初始化 run 并进入游戏状态 */
  quickStart(characterIds: number[], currency: number): void {
    const tagsList = this.getTagsList(characterIds);
    this.run.characters = characterIds;
    this.run.deck = generateInitialDeck(tagsList);
    this.run.currency = currency;
    this.run.floor = 1;
    this.run.path = this.generatePath(0);
    this.run.currentNodeIndex = 0;
    this.run.availableCharacters = rollCharacterChoices(CHARACTER_CHOICE_COUNT, this.data, characterIds, this.getCharacterPool());
    // 处理当前节点（可能是事件节点）
    this.processCurrentNode();
  }

  /** @internal 调试用：直接进入指定事件（用于事件测试） */
  enterEvent(event: EventDefinition, characterIds?: number[], onConfirm?: () => void): void {
    // 确保有基本的运行状态
    if (this.run.characters.length === 0) {
      const chars = characterIds && characterIds.length >= 2 ? characterIds : [1501, 1701];
      this.run.characters = chars;
      this.run.deck = generateInitialDeck(this.getTagsList(chars));
    }
    if (this.run.floor === 0) {
      this.run.floor = 1;
      this.run.path = this.generatePath(0);
    }
    this.run.currentEvent = event;
    this.onEventConfirm = onConfirm ?? null;
    this.setState("event");
  }

  /** @internal 调试用：直接应用一个事件的效果（用于事件测试面板） */
  applyEvent(event: EventDefinition): void {
    applyEventEffects(event.effects, this.run, this.data);
    if (!this.run.completedEventIds.includes(event.id)) {
      this.run.completedEventIds = [...this.run.completedEventIds, event.id];
    }
    this.notify();
  }
}
