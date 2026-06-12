import { createSignal, type Accessor, type Setter } from "solid-js";
import type { EnemyConfig, RoguelikeConfig, CardWeightPair, EventDefinition, CardWeightStorageAdapter, EnemyPool } from "@gi-tcg/roguelike";
import { CardWeightManager } from "@gi-tcg/roguelike";
export type { EnemyPool } from "@gi-tcg/roguelike";
import defaultEnemies from "./config/enemies.json";
import defaultLevels from "./config/levels.json";
import { createBestStorage } from "./file-storage";

// ============================================================
// 存储接口
// ============================================================

export interface ConfigStorage {
  load<T>(key: string, fallback: T): T;
  save(key: string, data: unknown): void;
}

export class LocalStorageAdapter implements ConfigStorage {
  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch { /* ignore invalid JSON */ }
    return fallback;
  }
  save(key: string, data: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* quota exceeded, ignore */ }
  }
}

export class InMemoryAdapter implements ConfigStorage {
  private store = new Map<string, string>();
  load<T>(key: string, fallback: T): T {
    const raw = this.store.get(key);
    if (raw) return JSON.parse(raw) as T;
    return fallback;
  }
  save(key: string, data: unknown): void {
    this.store.set(key, JSON.stringify(data));
  }
}

// ============================================================
// 配置存储类
// ============================================================

const ENEMY_POOL_KEY = "gi-tcg-enemy-pool";
const LEVEL_CONFIG_KEY = "gi-tcg-level-config";
const CARD_WEIGHTS_KEY = "gi-tcg-card-weights";
const DISMISSED_KEY = "gi-tcg-dismissed-suggestions";
const CATEGORY_W_KEY = "gi-tcg-category-weights";
const CARD_COSTS_KEY = "gi-tcg-card-costs";
const EVENTS_KEY = "gi-tcg-events";

function validateEnemyPool(data: unknown): EnemyPool {
  if (!data || typeof data !== "object") return defaultEnemies as EnemyPool;
  const d = data as Record<string, unknown>;
  const filterValid = (list: unknown): EnemyConfig[] =>
    (Array.isArray(list) ? list : []).filter((e: any) => e && typeof e.characterId === "number" && e.characterId > 0);
  const result: EnemyPool = {
    normal: filterValid(d.normal),
    elite: filterValid(d.elite),
    boss: filterValid(d.boss),
  };
  if (result.normal.length === 0 && result.elite.length === 0 && result.boss.length === 0) {
    return defaultEnemies as EnemyPool;
  }
  return result;
}

export class ConfigStore {
  readonly storage: ConfigStorage;

  // 信号
  readonly enemyPool: Accessor<EnemyPool>;
  readonly levelConfig: Accessor<RoguelikeConfig>;
  readonly dismissed: Accessor<Set<string>>;
  readonly categoryWeights: Accessor<Record<string, number>>;
  /** 卡牌自定义费用（cardId → cost） */
  readonly cardCosts: Accessor<Record<number, number>>;
  readonly cardWeights: Accessor<{ version: number; pairs: CardWeightPair[] }>;
  /** 事件定义列表 */
  readonly events: Accessor<EventDefinition[]>;

  private readonly _setEnemyPool: Setter<EnemyPool>;
  private readonly _setLevelConfig: Setter<RoguelikeConfig>;
  private readonly _setDismissed: Setter<Set<string>>;
  private readonly _setCategoryWeights: Setter<Record<string, number>>;
  private readonly _setCardCosts: Setter<Record<number, number>>;
  private readonly _setCardWeights: Setter<{ version: number; pairs: CardWeightPair[] }>;
  private readonly _setEvents: Setter<EventDefinition[]>;

  constructor(storage: ConfigStorage) {
    this.storage = storage;

    const [ep, setEp] = createSignal<EnemyPool>(validateEnemyPool(storage.load(ENEMY_POOL_KEY, null)));
    this.enemyPool = ep;
    this._setEnemyPool = setEp;

    const [lc, setLc] = createSignal<RoguelikeConfig>(storage.load(LEVEL_CONFIG_KEY, defaultLevels as RoguelikeConfig));
    this.levelConfig = lc;
    this._setLevelConfig = setLc;

    const [d, setD] = createSignal<Set<string>>(new Set(storage.load<string[]>(DISMISSED_KEY, [])));
    this.dismissed = d;
    this._setDismissed = setD;

    const [cw, setCw] = createSignal<Record<string, number>>(storage.load<Record<string, number>>(CATEGORY_W_KEY, {}));
    this.categoryWeights = cw;
    this._setCategoryWeights = setCw;

    const [cc, setCc] = createSignal<Record<number, number>>(storage.load<Record<number, number>>(CARD_COSTS_KEY, {}));
    this.cardCosts = cc;
    this._setCardCosts = setCc;

    const [cwData, setCwData] = createSignal<{ version: number; pairs: CardWeightPair[] }>(
      storage.load(CARD_WEIGHTS_KEY, { version: 1, pairs: [] })
    );
    this.cardWeights = cwData;
    this._setCardWeights = setCwData;

    const [ev, setEv] = createSignal<EventDefinition[]>(
      storage.load<EventDefinition[]>(EVENTS_KEY, [])
    );
    this.events = ev;
    this._setEvents = setEv;
  }

  /**
   * 创建一个带持久化的 CardWeightManager。
   * 写操作自动同步到 configStore，无需手动 saveToStorage。
   */
  createCardWeightManager(): CardWeightManager {
    const storage: CardWeightStorageAdapter = {
      load: () => {
        const data = this.cardWeights();
        return (data.pairs ?? []).filter(
          (p: any) => typeof p?.a === "number" && typeof p?.b === "number" && typeof p?.weight === "number"
        );
      },
      save: (pairs: CardWeightPair[]) => {
        this._setCardWeights({ version: 1, pairs });
        this.storage.save(CARD_WEIGHTS_KEY, { version: 1, pairs });
      },
    };
    return new CardWeightManager(undefined, storage);
  }

  // ---- 敌人池 ----

  setEnemyPool(pool: EnemyPool): void {
    this._setEnemyPool(pool);
    this.storage.save(ENEMY_POOL_KEY, pool);
  }

  resetEnemyPool(): void {
    this.setEnemyPool(structuredClone(defaultEnemies) as EnemyPool);
  }

  // ---- 关卡配置 ----

  setLevelConfig(config: RoguelikeConfig): void {
    this._setLevelConfig(config);
    this.storage.save(LEVEL_CONFIG_KEY, config);
  }

  resetLevelConfig(): void {
    this.setLevelConfig(structuredClone(defaultLevels) as RoguelikeConfig);
  }

  // ---- 卡牌权重 ----

  getCardWeights(): { version: number; pairs: CardWeightPair[] } {
    return this.cardWeights();
  }

  setCardWeights(data: { version: number; pairs: CardWeightPair[] }): void {
    this._setCardWeights(data);
    this.storage.save(CARD_WEIGHTS_KEY, data);
  }

  // ---- 已忽略建议 ----

  setDismissed(keys: string[]): void {
    this._setDismissed(new Set(keys));
    this.storage.save(DISMISSED_KEY, keys);
  }

  // ---- 分类权重 ----

  setCategoryWeights(weights: Record<string, number>): void {
    this._setCategoryWeights(weights);
    this.storage.save(CATEGORY_W_KEY, weights);
  }

  // ---- 卡牌费用 ----

  setCardCosts(costs: Record<number, number>): void {
    this._setCardCosts(costs);
    this.storage.save(CARD_COSTS_KEY, costs);
  }

  // ---- 事件 ----

  setEvents(events: EventDefinition[]): void {
    this._setEvents(events);
    this.storage.save(EVENTS_KEY, events);
  }

  // ---- 统一操作 ----

  exportAll(): void {
    const all = {
      enemyPool: this.enemyPool(),
      levelConfig: this.levelConfig(),
      cardWeights: this.getCardWeights(),
      dismissedSuggestions: [...this.dismissed()],
      categoryWeights: this.categoryWeights(),
      cardCosts: this.cardCosts(),
      events: this.events(),
    };
    exportJson(all, "roguelike-config.json");
  }

  async importAll(): Promise<boolean> {
    const data = await importJson<{
      enemyPool?: EnemyPool;
      levelConfig?: RoguelikeConfig;
      cardWeights?: { version: number; pairs: CardWeightPair[] };
      dismissedSuggestions?: string[];
      categoryWeights?: Record<string, number>;
      cardCosts?: Record<number, number>;
      events?: EventDefinition[];
    }>();
    if (!data) return false;
    if (data.enemyPool) this.setEnemyPool(data.enemyPool);
    if (data.levelConfig) this.setLevelConfig(data.levelConfig);
    if (data.cardWeights) this.setCardWeights(data.cardWeights);
    if (data.dismissedSuggestions) this.setDismissed(data.dismissedSuggestions);
    if (data.categoryWeights) this.setCategoryWeights(data.categoryWeights);
    if (data.cardCosts) this.setCardCosts(data.cardCosts);
    if (data.events) this.setEvents(data.events);
    return true;
  }

  resetAll(): void {
    this.resetEnemyPool();
    this.resetLevelConfig();
    this.setCardWeights({ version: 1, pairs: [] });
    this.setDismissed([]);
    this.setCategoryWeights({});
    this.setCardCosts({});
    this.setEvents([]);
  }
}

// ============================================================
// 默认实例（生产环境用 localStorage）
// ============================================================

export const configStore = new ConfigStore(createBestStorage());

// ============================================================
// JSON 文件工具（独立于 configStore）
// ============================================================

export function exportJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importJson<T>(): Promise<T | null> {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) { resolve(null); return; }
      try {
        const text = await f.text();
        resolve(JSON.parse(text) as T);
      } catch {
        alert("导入失败：JSON 格式错误");
        resolve(null);
      }
    };
    inp.click();
  });
}
