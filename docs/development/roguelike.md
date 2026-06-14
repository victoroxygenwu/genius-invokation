# Roguelike 模式开发指南

> 本文档是 roguelike PvE 模式的完整技术文档，涵盖架构设计、模块职责、数据流、扩展指南和代码规范。

## 目录

- [1. 概述](#1-概述)
- [2. 包结构与依赖](#2-包结构与依赖)
- [3. 核心架构](#3-核心架构)
- [4. 类型系统](#4-类型系统)
- [5. 状态机与游戏流程](#5-状态机与游戏流程)
- [6. 敌人系统](#6-敌人系统)
- [7. 卡牌与卡池系统](#7-卡牌与卡池系统)
- [8. 事件系统](#8-事件系统)
- [9. 经济系统](#9-经济系统)
- [10. 存档系统](#10-存档系统)
- [11. UI 架构](#11-ui-架构)
- [12. 自定义敌人指南](#12-自定义敌人指南)
- [13. 自定义事件指南](#13-自定义事件指南)
- [14. 自定义卡牌效果指南](#14-自定义卡牌效果指南)
- [15. 敌人脚本与 AI](#15-敌人脚本与-ai)
- [16. 测试指南](#16-测试指南)
- [17. 代码规范](#17-代码规范)

---

## 1. 概述

Roguelike 模式是一个基于原神七圣召唤引擎的 PvE Roguelike 卡牌构建器。玩家从 2 个角色开始，通过多层关卡（每层包含多个节点），面对随机敌人、商店、事件，逐步构建卡组，最终击败 Boss 通关。配置存储在 `configStore.levelConfig` 中，持久化到 localStorage/IndexedDB。

**核心特性：**
- **关卡结构可配置：** 层数、每层节点数量和顺序、敌人组合、固定事件均可自由调整（默认 3 层，第 1 层 6 节点，第 2-3 层 5 节点）
- **动态卡池：** 根据队伍组成（元素共鸣、地区共鸣、天赋牌）自动调整奖励和商店的卡牌池
- **权重系统：** 卡牌关联权重影响抽取概率，支持手动编辑和自动分析
- **事件系统：** 15 种条件类型 × 11 种效果类型，支持 AND/OR 条件模式，可自定义剧情和效果
- **敌人系统：** 9 种修饰器类型（HP、状态、支援牌等），技能由代码脚本定义，数值可通过编辑器调整
- **存档系统：** 防抖自动存档 + beforeunload 同步刷写，支持暂离和继续
- **可视化编辑器：** 敌人编辑器、关卡编辑器、事件编辑器、权重编辑器、费用编辑器（通过 DebugPanel 访问）

---

## 2. 包结构与依赖

```
@gi-tcg/roguelike          ← 纯逻辑，零 UI 依赖
  ├── types.ts              ← 所有类型定义
  ├── run.ts                ← RoguelikeRunManager（状态机）
  ├── data.ts               ← 常量、经济公式、敌人定义（重新导出子模块）
  ├── default-events.ts     ← 17 个默认事件定义 + 回退事件 ID 集合
  ├── default-levels.ts     ← ROGUELIKE_CONFIG 默认关卡配置
  ├── pool.ts               ← 敌人池、角色池、初始卡组、楼层路径
  ├── card-pool.ts          ← 动态卡池生成、卡牌抽取
  ├── card-weights.ts       ← 卡牌关联权重（Dijkstra + 多源扩散）
  ├── card-relationships.ts ← 自动分析卡牌关联（5 层分析）
  ├── events.ts             ← 事件评估、选择、模板渲染、效果应用
  ├── modifier-resolver.ts  ← 修饰器 → 游戏实体解析
  ├── ai.ts                 ← 敌人 AI（优先级策略）
  ├── utils.ts              ← 工具函数（名称、图片、采样）
  └── index.ts              ← 统一导出（含分类注释）

@gi-tcg/roguelike-data      ← 游戏数据定义（自定义角色/卡牌）
  ├── begin.ts / end.ts     ← 注册表初始化与冻结
  ├── version-meta.ts       ← TypeScript 声明合并
  ├── enemies/              ← 自定义敌人角色定义（Builder DSL）
  │   └── surtr_loki.ts     ← 苏尔特洛奇（ID 9002）
  └── overrides/            ← 覆盖现有卡牌效果
      └── place_cards.ts    ← 增强版场地牌

@gi-tcg/data/src/pve.ts     ← PvE 专用状态效果（PvEFullRevive 等）

@gi-tcg/standalone/src/     ← SolidJS UI
  ├── PvEMode.tsx           ← 主编排组件
  ├── roguelike-assets.ts   ← 自定义实体资源包装器
  ├── event-descriptors.ts  ← 事件编辑器字段描述符（UI 层）
  ├── pve/                  ← 8 个页面组件
  ├── DebugPanel.tsx        ← 调试面板
  ├── EditorToolbar.tsx     ← 通用工具栏组件（导出/导入/重置 + AutosaveHint）
  ├── EnemyEditor.tsx       ← 敌人编辑器
  ├── EventEditor.tsx       ← 事件编辑器
  ├── LevelEditor.tsx       ← 关卡编辑器
  ├── CardWeightEditor.tsx  ← 权重编辑器
  ├── configStore.ts        ← 配置持久化（含 Tauri 文件对话框、reset 方法）
  └── config/
      └── default-card-weights.json  ← 默认权重预设（757KB）
```

**依赖方向：** `standalone` → `roguelike` + `roguelike-data` + `data`，`roguelike` 不依赖任何 UI 包。

---

## 3. 核心架构

### 3.1 数据流

```
configStore (localStorage/IndexedDB)
      ↓
PvEMode.createRunManager()
      ↓
RoguelikeRunManager(data, config, enemyPool, cardCosts, options)
      ↓ options = { storage?, saveKey?, onEventConfirm? }
      ↓ run: RoguelikeRun
      ↓ onUpdate callback
PvEMode [run, setRun] signal
      ↓
Switch/Match → 子组件 (props: run, runManager, callbacks)
```

**构造函数完整签名：**
```typescript
constructor(
  data: GameData,
  config: RoguelikeConfig = ROGUELIKE_CONFIG,
  enemyPool?: EnemyPool,
  cardCosts?: Record<number, number>,
  options?: {
    storage?: SimpleStorage;   // 存档存储后端
    saveKey?: string;          // 存档 key
    onEventConfirm?: () => void; // 事件确认回调（调试用）
  }
)
```

### 3.2 响应式模型

`RoguelikeRunManager.notify()` 通过创建新对象引用触发 SolidJS 响应式更新：

```typescript
private notify(): void {
  this.onUpdate?.({ ...this.run });  // 新引用 → 触发信号更新
  if (this.autoSaveEnabled) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.persistRun(); }, 500);
  }
}
```

### 3.3 关键设计决策

| 决策 | 原因 |
|------|------|
| 状态机集中在 `run.ts` | 避免状态转换分散在多个文件 |
| 修饰器用解析器表 | 数据驱动，新增修饰器只需加一行映射 |
| 事件用条件+效果组合 | 15×11 的笛卡尔积覆盖大部分场景 |
| 存档排除 currentEvent/currentEncounter | 这些包含不可序列化的 GameData 引用 |
| AI 用优先级策略 | 简单可预测，易于调试 |

---

## 4. 类型系统

### 4.1 核心类型定义在 `types.ts`

**RunState（9 种状态）：**
```
characterSelect → addCharacter → encounterSelect → battle → reward → shop → event
                                    ↑                                    ↓
                                    └────────────── processCurrentNode ←─┘
                                                      ↓
                                                   victory / gameOver
```

**EnemyModifier（9 种修饰器类型）：**
```typescript
type EnemyModifier =
  | { type: "immuneControl" }                    // 无参数，免疫石化/冻结/眩晕
  | { type: "innateTalent" }                     // 自动推断天赋牌
  | { type: "fullEnergy" }                       // 开局满能量
  | { type: "revive"; value: number }            // value = 复活次数
  | { type: "damageReduction"; value: number; value2?: number }  // value = 减伤量, value2 = 层数
  | { type: "damageBoost"; value: number; value2?: number }      // value = 增伤量, value2 = 层数
  | { type: "supportCard"; value: number }       // value = 支援牌实体 ID
  | { type: "autoDish"; value: number }          // value = 食物卡 ID（0 = 随机状态）
  | { type: "innateArtifact"; value: number };   // value = 圣遗物卡 ID
```

> **注意：** 无参数类型（`ModifierWithoutValue`）和带数值类型（`ModifierWithNumber`）在代码中通过判别联合区分，`value` 对于带数值类型是必填字段。解析时 `modNum()` 函数提供回退默认值（revive=1, damageReduction/damageBoost 的 value2 默认取 value）。`value2` 仅对 damageReduction/damageBoost 有效，表示可用次数层数。

**EventConditionType（15 种条件）：**
- 卡牌相关：`hasCard`, `hasAnyCards`
- 角色相关：`hasCharacterTag`, `hasCharacter`, `hasAllCharacters`, `noCharacter`, `teamOnlyElements`
- 进度相关：`defeatedEnemy`, `floorAtLeast`, `currencyAtLeast`, `deckSizeAtLeast`, `teamSizeAtLeast`, `teamSizeAtMost`
- 事件相关：`anyEventCompleted`, `noEventCompleted`

**EventEffectType（11 种效果）：**
- 经济：`addCurrency`, `removeCurrency`
- 卡牌：`addCard`, `removeCard`, `randomCard`, `chooseAndRemoveCard`
- 角色：`modifyCharacterMaxHp`, `addCharacter`
- 战斗：`modifyNextBattleAllyHp`, `modifyNextBattleEnemyHp`, `skipNextNormalBattle`

### 4.2 RoguelikeRun（运行时状态）

```typescript
interface RoguelikeRun {
  state: RunState;                    // 当前状态
  floor: number;                      // 当前楼层（1-based）
  maxFloors: number;                  // 最大楼层数
  floorSkipCharSelection: boolean;    // 当前层是否跳过角色选择（每层开始时设置：满 4 人 true 并递归处理，否则 false 进入 addCharacter）
  characters: number[];               // 角色 ID 列表
  deck: number[];                     // 卡组（卡牌 ID 列表，可重复）
  currency: number;                   // 货币
  path: PathNode[];                   // 当前层路径
  currentNodeIndex: number;           // 当前节点索引
  currentEncounter: Encounter | null; // 当前遭遇（战斗时非 null）
  shopItems: ShopItem[];              // 商店物品
  refreshCount: number;               // 商店刷新次数（影响费用）
  deleteCount: number;                // 删牌次数（影响费用）
  rewardItems: Reward[];              // 奖励卡牌
  availableCharacters: CharacterPoolEntry[]; // 可选角色
  completedEventIds: number[];        // 已完成事件 ID
  currentEvent: EventDefinition | null; // 当前事件
  nextBattleAllyHpModifier: number;   // 下一场战斗我方 HP 修正（全局，当前 HP 直接受影响；最大 HP 仅在新 HP 超过原最大值时提升）
  nextBattleEnemyHpModifier: number;  // 下一场战斗敌方 HP 修正（全局）
  characterHpModifiers: Record<number, number>; // 角色 HP 修正（charId → 修正量，当前 HP 直接受影响；最大 HP 仅在新 HP 超过原最大值时提升）
  skipNextNormalBattle: boolean;      // 跳过下一个普通战斗节点
  pendingChooseAndRemoveCard: boolean; // 等待玩家选择删卡
}
```

---

## 5. 状态机与游戏流程

### 5.1 状态转换图

```
[开始]
  │
  ▼
characterSelect ──(选 2 角色)──→ processCurrentNode ←──────────────────┐
  │                                     │                              │
  │                    ┌────────────────┼────────────────┐             │
  │                    ▼                ▼                ▼             │
  │               encounterSelect    shop             event            │
  │                    │                │                │             │
  │                    ▼                ▼                │             │
  │                 battle         finishShop()          │             │
  │                    │                │                │             │
  │                    ▼                └────────────────┘             │
  │               reward                                  │            │
  │                    │                    confirmEvent() │            │
  │                    └──────────→ processCurrentNode ←──┘            │
  │                                     │                              │
  │                          ┌──────────┴──────────┐                   │
  │                          ▼                     ▼                   │
  │                    addCharacter            (下一节点)               │
  │                          │                     │                   │
  │                          ▼                     ▼                   │
  │                    processCurrentNode      (楼层完成)              │
  │                                               │                   │
  │                                    ┌──────────┴──────────┐        │
  │                                    ▼                     ▼        │
  │                               (更多楼层)            (最终层)       │
  │                                    │                     │        │
  │                              generatePath            victory      │
  │                                    │                               │
  │                                    └──(满4人时递归跳过选角)────────┘
  │
  ├──(战斗失败)──→ gameOver
```

**注意：** `confirmEvent()` 和 `finishShop()` 是 `RoguelikeRunManager` 的方法调用，不是 `RunState`。它们将状态推进到下一个节点对应的状态。

### 5.2 processCurrentNode 路由逻辑

```typescript
private processCurrentNode(): void {
  const node = this.getCurrentNode();
  if (!node) {
    // 当前层所有节点完成
    if (this.run.floor < this.run.maxFloors) {
      this.run.floor++;
      // 满 4 人后自动跳过角色选择
      this.run.floorSkipCharSelection = this.run.characters.length >= MAX_TEAM_SIZE;
      if (this.run.floorSkipCharSelection) {
        this.run.path = this.generatePath(this.run.floor - 1);
        this.run.currentNodeIndex = 0;
        this.processCurrentNode(); // 递归处理新层的第一个节点
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

  // 跳过普通战斗节点（由事件效果 skipNextNormalBattle 设置）
  if (this.run.skipNextNormalBattle && node.type === "normal") {
    this.run.skipNextNormalBattle = false;
    node.completed = true;
    this.run.currentNodeIndex++;
    this.processCurrentNode();
    return;
  }

  // 按节点类型路由
  switch (node.type) {
    case "shop":    → rollShopCards → setState("shop")
    case "event":   → resolveEvent → setState("event") 或跳过
    default:        → setState("encounterSelect")  // normal/elite/boss
  }
}
```

---

## 6. 敌人系统

### 6.1 敌人定义

敌人定义在 `data.ts` 的 `ENEMY_DEFS` 数组中，格式为 `[characterId, tier]` 元组：

```typescript
const ENEMY_DEFS: [number, EncounterType][] = [
  // 普通敌人（17 个）
  [2101, "normal"], [2104, "normal"], [2202, "normal"], [2205, "normal"],
  [2203, "normal"], [2207, "normal"], [2301, "normal"], [2303, "normal"],
  [2302, "normal"], [2404, "normal"], [2405, "normal"], [2406, "normal"],
  [2503, "normal"], [2601, "normal"], [2604, "normal"], [2703, "normal"],
  [2705, "normal"],
  // 精英敌人（13 个）
  [2103, "elite"], [2201, "elite"], [2206, "elite"], [2304, "elite"],
  [2306, "elite"], [2401, "elite"], [2402, "elite"], [2403, "elite"],
  [2501, "elite"], [2603, "elite"], [2605, "elite"], [2701, "elite"],
  [2704, "elite"],
  // Boss（6 个官方 + 1 个 roguelike 专属）
  [2102, "boss"], [2204, "boss"], [2305, "boss"], [2502, "boss"],
  [2602, "boss"], [2702, "boss"],
  [9002, "boss"],  // 极恶骑·苏尔特洛奇（roguelike 专属）
];
```

### 6.2 敌人配置（EnemyConfig）

```typescript
interface EnemyConfig {
  characterId: number;           // 角色 ID（对应 GameData 中的定义）
  hpOverride: number | null;     // HP 覆盖（null = 使用公式计算）
  currencyReward: number | null; // 击败货币奖励（null = 使用类型默认值）
  modifiers: EnemyModifier[];    // 修饰器列表
  locked?: boolean;              // 锁定（编辑器编辑时不会写回全局池）
}
```

### 6.3 HP 公式

```typescript
function getEnemyHp(floor: number, type: EncounterType): number {
  const base = BASE_HP[type];  // normal:10, elite:20, boss:30
  const multiplier = FLOOR_HP_MULTIPLIER[floor - 1] ?? 1.0; // [1.0, 1.5, 2.0, 2.5]，超出范围回退 1.0
  return Math.max(1, Math.round(base * multiplier));
}
// 示例：3 层 Boss = max(1, round(30 * 2.0)) = 60 HP
```

### 6.4 修饰器解析流程

`modifier-resolver.ts` 中的 `resolveModifier` 函数有以下解析路径：

```
EnemyConfig.modifiers[]
      ↓
resolveModifier(mod, characterId, data)
      ↓
┌─ ENTITY_RESOLVERS 表:
│    immuneControl, revive, damageReduction, damageBoost, innateArtifact → status 实体
│    innateTalent → 仅当定义类型为 equipment 时生成 status 实体
├─ supportCard → 独立 if 分支，查找 support/summon 实体
├─ autoDish → 独立 if/else 分支（value>0 为指定食物卡，value=0 为随机料理状态）
├─ innateTalent（非 equipment 定义时）→ 作为 handCard
└─ fullEnergy → 标记分支，设置 fullEnergy flag
      ↓
ModifierEffect[] ← { kind: "status"|"support"|"handCard"|"flag", ... }
      ↓
run.ts.prepareEnemyState() → 应用到 GameState
```

---

## 7. 卡牌与卡池系统

### 7.1 初始卡组生成

每个角色贡献：**1 张武器卡 + 1 张圣遗物卡**，加上 **2 张蒙德土豆饼**。

```typescript
// 简化示意，实际实现见 pool.ts 的 cardsForCharacter 辅助函数
function generateInitialDeck(characterTagsList: string[][]): number[] {
  const deck: number[] = [];
  for (const tags of characterTagsList) {
    // 武器卡：按武器标签查找，找不到时回退到 DEFAULT_WEAPON_CARD（332008）
    const weaponTag = tags.find(t => WEAPON_CARD_MAP[t] !== undefined);
    deck.push(weaponTag ? WEAPON_CARD_MAP[weaponTag] : DEFAULT_WEAPON_CARD);
    // 圣遗物卡：按元素标签查找
    const elementTag = tags.find(t => ARTIFACT_CARD_MAP[t]);
    if (elementTag) deck.push(ARTIFACT_CARD_MAP[elementTag]);
  }
  deck.push(MONDSTADT_HASH_BROWN, MONDSTADT_HASH_BROWN);
  return deck;
}
```

### 7.2 动态卡池生成

`generateCardPool(data, characterIds, floor)` 按 5 个类别构建卡池：

| 类别 | 条件 | 示例 |
|------|------|------|
| 普通行动牌 | 3xxxxx 范围，排除初始/条件/不可获取 | 立本、最好的伙伴 |
| 天赋牌 | 2xxxxx 范围，仅限队伍角色，**排除怪物角色的天赋牌**（通过 `ENEMY_CHARACTER_IDS` 过滤） | 魔偶剑鬼天赋 |
| 元素共鸣 | 2+ 同元素角色 | 火元素共鸣·热诚之火 |
| 元素转化 | >= 4 角色且恰好 2 种元素 | 超导祝佑（cryo+electro）等 |
| 地区共鸣 | 2+ 同地区角色 | 蒙德共鸣·迅捷之风 |

> **注意：** `floor` 参数当前未被使用，所有卡牌筛选逻辑均不依赖楼层。

### 7.3 权重采样

卡牌抽取使用加权采样，权重由 `CardWeightManager.computeCardWeights()` 计算：

**多源扩散算法：**
1. 卡组中每张卡的初始信号 = 1.0
2. 沿邻接表向外扩散，每跳衰减 alpha=0.5
3. 多源传播到同一节点时**加法累加**（`signal += contribution`）
4. 最大 4 轮扩散，单次传播贡献（contribution = nodeSignal × edgeWeight × roundWeight）< 0.01 时跳过该条路径
5. 最终权重 = 1 + signal，理论范围 [1.0, +∞)，实际通常在 [1.0, 3.0] 之间（因 `processed` 集合限制，节点仅在首次被发现的轮次接收累积信号）

**效果示例：**
- 卡组中有「魔偶剑鬼」→「魔偶剑鬼天赋」权重很高（直接关联）
- 卡组中有「魔偶剑鬼」→「冰元素共鸣」权重中等（间接关联）
- 无关卡牌 → 权重 = 1.0（基准）

### 7.4 卡牌关系自动分析

`CardRelationshipAnalyzer.analyzeRelationships()` 对可获得卡牌进行 5 层分析，生成 `SuggestedPair[]` 建议关联供权重编辑器使用。所有 card↔card 关联都**排除天赋牌之间的直接关联**（避免不相关的天赋牌互相拉高权重），怪物角色的天赋牌在初始化时就被过滤（通过 `ENEMY_CHARACTER_IDS` 排除）。

#### 第 1 层：结构化数据（标签、类型、关联角色）

| 关联类型 | 权重 | 说明 |
|----------|------|------|
| 天赋牌 → 绑定角色 | 0.9 | 如「魔偶剑鬼天赋」→ 魔偶剑鬼 |
| 元素共鸣牌 → 同元素角色 | 0.7 | 如「热诚之火」→ 所有火元素角色 |
| 武器牌 → 同武器角色 | 0.7 | 如「天空之刃」→ 所有单手剑角色 |
| 地区共鸣牌 → 同地区角色 | 0.7 | 如「蒙德共鸣」→ 所有蒙德角色 |
| 元素幻变牌 → 所需元素角色 | 0.7 | 如「超导祝佑」→ 所有冰/雷元素角色 |

**统一角色约束（`buildCardCharConstraints`）：** 武器牌、元素共鸣、元素幻变、地区共鸣牌只能关联满足条件的角色。该方法统一处理这四类卡牌的角色限制，返回 `Map<卡牌ID, Set<角色ID>>`。无记录的卡牌 = 无角色限制。

#### 第 2 层：卡牌类型关键词

从卡牌**描述文本**中匹配大类别关键词（如"武器"、"圣遗物"、"支援牌"、"场地牌"等），将匹配同一类别的卡牌互相弱关联（权重 0.2-0.4）。

#### 第 3 层：特定卡牌名称引用

从描述文本中解析出其他卡牌或角色的**名称**，建立直接关联（权重 0.5）。例如「最好的伙伴」描述中提到"派蒙"→ 检索派蒙（ID 1503）。

#### 第 4 层：效果关键词深层分析

通过 `KEYWORD_CATEGORIES`（20 个类别）对实体语料进行深入分析。语料来源包括：
- **角色语料（`getCharacterCorpus`）：** 角色的每个技能名称 + 描述，以及技能衍生的实体（status/summon/support）名称 + 描述
- **卡牌语料（`getCardCorpus`）：** 卡牌本身的描述，以及卡牌衍生的实体描述

**20 个关键词类别**支持三种匹配方式：

| 类别 | 匹配方式 | card→char 权重 | card→card 权重 |
|------|----------|:-------------:|:-------------:|
| 准备技能 | `entityTag: GCG_TAG_PREPARE_SKILL` | 0.40 | 0.30 |
| 夜魂 | `entityTag: GCG_TAG_NYX_STATE` | 0.45 | 0.35 |
| 下落攻击 | `entityTag: GCG_TAG_FALL_ATTACK` | 0.45 | 0.35 |
| 冒险 | `entityTag: GCG_TAG_ADVENTURE_PLACE` | 0.35 | 0.25 |
| 重击 | 文本关键词 | 0.40 | 0.30 |
| 普通攻击 | 文本关键词 | 0.35 | 0.25 |
| 元素战技 | 文本关键词 | 0.40 | 0.30 |
| 治疗 | 文本关键词（"受到伤害或治疗"、"治疗"） | 0.40 | 0.30 |
| 生命之契 | 文本关键词 | 0.45 | 0.35 |
| 随机 | 文本关键词（"不属于初始卡组的牌"等） | 0.35 | 0.30 |
| 召唤 | 文本关键词（"召唤物"、"召唤"） | 0.45 | 0.35 |
| 舍弃 | 文本关键词 | 0.40 | 0.30 |
| 元素爆发/充能 | 文本关键词（"元素爆发"、"充能"） | 0.40 | 0.30 |
| 赋予 | 文本关键词（"赋予"、"赋能"、"费用降低"） | 0.35 | 0.30 |
| 快速行动 | 文本关键词（"快速行动"、"敏捷切换"） | 0.40 | 0.30 |
| 切换角色 | 文本关键词（"切换角色"、"高效切换"） | 0.40 | 0.30 |
| 抓牌 | 文本关键词 + `pattern: /抓\d*张牌/` | 0.40 | 0.30 |

**分析流程：** 对每个关键词类别，找出所有匹配的卡牌和角色 → 建立 card↔char 关联（受角色约束限制）和 card↔card 关联（排除天赋牌互关，匹配数 > 60 时跳过 card↔card 避免组合爆炸）。

#### 第 5 层：随机类卡牌

硬编码的 `RANDOM_CARD_IDS` 集合（29 张卡牌 ID），这些卡牌在描述中提到"随机"但无法通过文本匹配识别，手动筛选后建立弱关联（权重 0.3 card↔char、0.2 card↔card）。

---

## 8. 事件系统

### 8.1 事件定义结构

```typescript
interface EventDefinition {
  id: number;              // 唯一 ID（2001-2999 为默认事件）
  name: string;            // 显示名称
  imageUrl: string;        // 剧情图片 URL
  storyTemplate: string;   // 剧情文字模板（支持 {{variable}}）
  conditionMode?: "and" | "or"; // 条件模式（默认 "or"）
  conditions: EventCondition[]; // 条件列表（带权重）
  effects: EventEffectType[];   // 效果列表
}
```

### 8.2 条件评估算法

```
evaluateEventWeight(event, run, data):
  对每个 condition:
    count = getMatchCount(condition, run, data)  // 实际匹配数
    threshold = condition.minCount ?? 1           // 最小匹配数
    if count >= threshold:
      scale = max(1, log2(count + 1))  // 递减收益缩放
      totalWeight += condition.weight * scale

  conditionMode = "or" (默认):
    任意条件满足 → 返回 max(totalWeight, 1)  // 至少为 1
    全不满足 → 返回 0

  conditionMode = "and":
    所有条件满足 → 返回 max(totalWeight, 1)
    任一不满足 → 返回 0
```

**缩放公式 `scale = max(1, log2(count + 1))`：**
- matchCount=1 → scale=1.0（基数）
- matchCount=2 → scale=1.58
- matchCount=3 → scale=2.0
- matchCount=5 → scale=2.58
- 设计意图：递减收益，避免单条件高数量权重爆炸

### 8.3 模板变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{playerNames}}` | 角色名称列表 | "班尼特、菲谢尔" |
| `{{deckSize}}` | 卡组数量 | "12" |
| `{{currency}}` | 当前货币 | "25" |
| `{{floor}}` | 当前楼层 | "2" |
| `{{teamSize}}` | 队伍人数 | "3" |
| `{{cardName:332001}}` | 卡牌名称 | "最好的伙伴" |
| `{{charName:1501}}` | 角色名称 | "班尼特" |

### 8.4 默认事件一览

共 17 个事件（ID 2001-2016 + 2999）：

| ID | 名称 | 条件 | 效果 |
|----|------|------|------|
| 2001 | 初遇派蒙 | 无条件 | addCard(最好的伙伴×2) |
| 2002 | 寰宇之旅 | hasCharacter(1116) OR defeatedEnemy(2204) | addCurrency(10), chooseAndRemoveCard |
| 2003 | 在阳光更好的日子再会 | hasCharacterTag(sumeru,2) OR hasCard(多项) | addCard(332026×2, 322022×2, 332040×2) |
| 2004 | 要做优秀的巡林员 | hasCharacter(1701/1702) OR hasCard(多项) | addCard(321014×2), modifyNextBattleEnemyHp(-10) |
| 2005 | 叮呤哐啷蛋卷工坊 | hasCharacter(1216/1417) OR hasCard(多项) | addCard×3 |
| 2006 | 霜月之坊 | hasCharacter(1711) OR hasCard(321037/217111) | addCard×2, addCurrency(5) |
| 2007 | 新月之拥 | hasCharacterTag(nodkrai,2) OR hasCard(多项) | addCard(330013), modifyNextBattleAllyHp(2) |
| 2008 | 夜客致访 | hasCharacter(1418) OR hasCard(321036/214181) | addCard×4, removeCurrency(5) |
| 2009 | 故事的种子 | hasCharacter(1503) OR hasCharacterTag(anemo,2) OR hasCard(多项) | addCard×3 |
| 2010 | 呀！呀！ | hasCard(313009×2) OR hasCard(332043) | addCard(313009×2), addCurrency(15) |
| 2011 | 闭嘴，哥们 | hasAllCharacters(1517,1709) OR hasAnyCards([215171,217091,332050,332044]) | modifyNextBattleAllyHp(-5), modifyNextBattleEnemyHp(-10), addCurrency(10) |
| 2012 | 不会吧，哥们 | AND: hasCharacter(1517) + hasAnyCards([215171,313006,332050,333016]) | skipNextNormalBattle, addCurrency(10) |
| 2013 | 束手就擒！ | AND: hasCharacter(1313) + teamOnlyElements(pyro,electro) | addCard×5 |
| 2014 | 伟大圣龙库胡勒阿乔 | hasCharacter(1709) OR hasCard(217091/313002/321024) | modifyNextBattleAllyHp(5), modifyNextBattleEnemyHp(-5), removeCurrency(5) |
| 2015 | 以极限之名 | hasCharacter(1709) OR hasCharacterTag(natlan,2) OR hasCard(多项) | addCard×6 |
| 2016 | 束手就擒！（招募） | AND: noCharacter(1313) + teamOnlyElements(pyro,electro) | addCharacter(1313), addCard(213131×2) |
| 2999 | 旅途小憩（兜底） | 无条件 | addCurrency(5), modifyNextBattleAllyHp(2) |

> **回退事件机制：** `FALLBACK_EVENT_IDS` 是一个 ID 集合（当前包含 2999），当无其他事件满足条件时从中随机选取。回退事件**可重复触发**，不会被记录到 `completedEventIds`。

---

## 9. 经济系统

### 9.1 货币来源

- **击败敌人：** normal=5, elite=10, boss=30（可被 EnemyConfig.currencyReward 覆盖）
- **利息：** `floor(min(currency, interestThreshold) / interestRate)`，默认 threshold=50, rate=10（即上限 = floor(50/10) = 5，可通过关卡编辑器调整 threshold 和 rate）
- **事件：** addCurrency / removeCurrency 效果

### 9.2 费用公式

**刷新商店：** `round(2 × 1.5^refreshCount)`（refreshCount 从 0 开始）
- 第 1 次 (count=0): 2, 第 2 次 (count=1): 3, 第 3 次 (count=2): 5, 第 4 次 (count=3): 7, 第 5 次 (count=4): 10

**删除卡牌：** `round(10 × 1.5^deleteCount)`（deleteCount 从 0 开始）
- 第 1 次 (count=0): 10, 第 2 次 (count=1): 15, 第 3 次 (count=2): 23

**商店卡牌：** 默认 5 货币，可通过 `cardCosts` 自定义

---

## 10. 存档系统

### 10.1 存档时机

- **自动存档：** 每次 `notify()` 后防抖 500ms
- **同步刷写：** `beforeunload` 事件触发 `flushSync()`
- **手动存档：** 暂离按钮
- **胜利时自动清除存档：** 通关后 `autoSaveEnabled` 置为 false 并调用 `clearSave()`，避免残留无效存档

### 10.2 快照序列化

```typescript
// 排除不可序列化字段，保留 currentEventId 用于恢复
type RunSnapshot = Omit<RoguelikeRun, "currentEvent" | "currentEncounter"> & {
  currentEventId?: number;
};
```

### 10.3 存档校验

有效存档必须满足：
- `floor` 为数字
- `characters.length > 0`
- `state` 不是 `victory`、`gameOver`、`characterSelect`

### 10.4 相关 API

- `RoguelikeRunManager.canSave(run)` — 静态方法，判断当前状态是否允许暂离（排除 `battle`/`victory`/`gameOver`）
- `ready(): Promise<boolean>` — 异步方法，从存储后端加载存档并恢复运行状态，返回是否成功加载
- `flushSync()` — 同步刷写（用于 beforeunload）
- `clearSave()` — 清除存档
- `RoguelikeRunManager.hasSave(storage, saveKey)` — 静态方法，检查是否有可用存档
- `eventRemoveCard(deckIndex)` — 事件删卡（不扣费、不计入全局删除次数）

### 10.5 存储后端

`SimpleStorageAdapter` 使用 IndexedDB，支持：
- `getItem` / `setItem`（异步）
- `writeSync`（同步，用于 beforeunload）
- 内存缓存 + 异步持久化

---

## 11. UI 架构

### 11.1 组件层次

```
PvEMode.tsx (主编排)
  ├── HomeScreen.tsx          ← 主菜单 + DebugPanel
  ├── CharacterSelectScreen   ← 选人（双模式：初始/追加）
  ├── EncounterSelectScreen   ← 路径地图 + 遭遇选择
  ├── BattleScreen.tsx        ← 战斗（chessboard UI）
  ├── RewardScreen.tsx        ← 奖励选择
  ├── ShopScreen.tsx          ← 商店
  ├── EventScreen.tsx         ← 事件展示
  ├── EndScreen.tsx           ← 通关/失败
  └── DeckDialog.tsx          ← 查看卡组弹窗（支持删除卡牌）
```

### 11.2 通信模式

- **向下：** PvEMode 通过 props 传递 `run` (Accessor) 和回调函数
- **向上：** 子组件调用回调（如 `onSelectEncounter`, `onBuyCard`）
- **共享状态：** `runManager()` 访问器、`debugMode`、`showToast`

### 11.3 自定义实体资源

`roguelike-assets.ts` 为自定义实体提供名称和图片：
- `ROGUELIKE_NAMES` 映射：ID → 中文名称
- `ROGUELIKE_IMAGES` 映射：ID → 图片 URL
- `createRoguelikeAssetsManager()`：构建包含自定义角色数据的 AssetsManager

### 11.4 编辑器系统

所有编辑器通过 DebugPanel 的按钮打开，使用 `OverlayPanel` 弹层组件。

**EditorToolbar 通用组件：** 所有编辑器共享的工具栏（`EditorToolbar.tsx`），提供导出 JSON 文件、导入 JSON 文件、重置预设功能，带有 toast 成功通知和确认弹窗。使用泛型 `EditorToolbar<T>` 支持不同类型的数据导出/导入。在 Tauri 环境下使用原生文件对话框，浏览器环境使用标准 `<a>` 下载和 `<input type="file">`。内置 `AutosaveHint` 共享组件（显示"✓ 自动保存"提示），敌人编辑器、事件编辑器、权重编辑器统一使用。

**useAutoSave hook：** 敌人编辑器和事件编辑器使用 `useAutoSave` hook 实现自动保存（300ms debounce），无需手动点击保存按钮。

**权重编辑器新增功能：**
- **"全部忽略"按钮：** 建议分组的标题栏新增 `dismissCategory` 按钮，一键忽略该类别下的所有建议
- **"清空"按钮：** 确认后清空所有权重数据 + 忽略列表
- **批量删除选中：** 多选模式下支持 `handleDeleteSelected`，确认后批量删除选中卡牌的所有关联
- **滚动保持：** `preserveScroll` 包装所有变更函数（接受建议、忽略、清空、删除、批量调节），在 DOM 更新后恢复滚动位置
- **防拖拽冲突：** 删除/操作按钮添加 `onPointerDown` + `stopPropagation`，防止触发拖拽选择

| 编辑器 | 组件 | 功能 | 保存方式 |
|--------|------|------|----------|
| 费用编辑器 | DebugPanel 内置 | 编辑卡池中每张卡的商店费用，支持多选批量调整（全体 +1/-1） | 手动（应用按钮） |
| 敌人编辑器 | `EnemyEditor.tsx` | 编辑敌人池（normal/elite/boss），配置修饰器、HP、货币奖励 | 自动保存 |
| 关卡编辑器 | `LevelEditor.tsx` | 配置层数、每层节点顺序、每个节点的敌人组合和固定事件 | 手动（保存按钮） |
| 权重编辑器 | `CardWeightEditor.tsx` | 可视化编辑卡牌关联权重，支持拖选、多选批量调节、全部忽略/清空/批量删除、自动分析建议 | 自动保存（EditorToolbar） |
| 事件编辑器 | `EventEditor.tsx` | 编辑事件条件、效果、剧情文本、图片 | 自动保存 |

**编辑器数据流：**
```
编辑器组件 → useAutoSave hook → configStore.setXxx() → localStorage/IndexedDB 持久化
                                                              ↓
PvEMode.createRunManager() ← configStore.getXxx() 读取
```

**默认关卡配置（FloorConfig[]）：**
```typescript
// default-levels.ts 中的 ROGUELIKE_CONFIG，仅作为默认预设
[
  { floor: 1, path: ["event", "normal", "event", "elite", "shop", "boss"],
    fixedEventIds: [2001] },  // 第一个 event 节点固定为"初遇派蒙"
  { floor: 2, path: ["normal", "event", "elite", "shop", "boss"] },
  { floor: 3, path: ["normal", "event", "elite", "shop", "boss"] },
]
// 通过关卡编辑器可自由调整：增删层数、改变节点顺序、指定固定敌人和事件
```

---

## 12. 自定义敌人指南

### 12.1 添加仅调整数值的敌人

适用于：复用官方角色 ID，仅修改 HP、添加修饰器。**这是敌人编辑器（EnemyEditor）能做的事。**

**步骤：**

1. 在 `data.ts` 的 `ENEMY_DEFS` 中添加条目：
```typescript
const ENEMY_DEFS: [number, EncounterType][] = [
  // ... 现有敌人
  [新角色ID, "normal"],  // 或 "elite" / "boss"
];
```

2. 在敌人编辑器或 `config/enemies.json` 中配置 `EnemyConfig`：
```json
{
  "characterId": 新角色ID,
  "hpOverride": null,
  "currencyReward": null,
  "modifiers": [
    { "type": "immuneControl" },
    { "type": "damageBoost", "value": 1, "value2": 2 }
  ]
}
```

### 12.2 添加自定义技能的敌人

适用于：需要新角色、新技能、新状态的 Boss。**必须修改代码，无法通过编辑器完成。**

**步骤：**

1. 在 `packages/roguelike-data/src/enemies/` 下创建新文件：
```typescript
// my_boss.ts
import { character, skill, status, card, DamageType } from "@gi-tcg/core/builder";

// 定义状态
const MyBossPassive = status(900301)
  .setVersionInfo("roguelike", {})
  .on("increaseDamage")
  .do((c, e) => { e.increaseDamage(1); })
  .done();

// 定义技能
const MyBossNormal = skill(90031)
  .setVersionInfo("roguelike", {})
  .type("normal")
  .costVoid(3)
  .damage(DamageType.Physical, 2)
  .done();

// 定义角色
export const MyBoss = character(9003)
  .setVersionInfo("roguelike", {})
  .tags("pyro", "monster", "boss")
  .health(40)
  .energy(2)
  .skills(MyBossNormal, /* ... */)
  .done();
```

2. 在 `packages/roguelike-data/src/enemies/index.ts` 中导出：
```typescript
export * from "./my_boss";
```

3. 在 `packages/roguelike/src/data.ts` 中注册 ID：
```typescript
const ENEMY_DEFS: [number, EncounterType][] = [
  // ...
  [9003, "boss"],
];
```

4. 在 `packages/standalone/src/roguelike-assets.ts` 中添加资源：
```typescript
const ROGUELIKE_NAMES: Record<number, string> = {
  // ...
  9003: "我的自定义 Boss",
  90031: "普通攻击名称",
};

const ROGUELIKE_IMAGES: Record<number, string> = {
  // ...
  9003: "https://...",
};
```

5. 在 `createRoguelikeAssetsManager()` 中添加角色元数据（供战斗 UI 显示）。

> **注意：** 自定义 Boss 的天赋牌会自动被 `ENEMY_CHARACTER_IDS` 排除（不进入卡池和权重分析）。如果需要 Boss 天赋牌出现在卡池中（如特殊 roguelike 事件），需将其定义在 `roguelike-data/src/overrides/` 中并使用独立 ID，而非标准天赋牌 ID 格式（2xxxxx）。

### 12.3 ID 命名规范

| ID 范围 | 用途 |
|---------|------|
| 1xxx | 官方角色 |
| 2xxxxx | 天赋牌（如 215171 = 角色 1517 的天赋） |
| 3xxxxx | 行动牌（事件牌、装备牌、共鸣牌等） |
| 9xxx | Roguelike 自定义角色 |
| 9xxxx | Roguelike 自定义技能 |
| 9xxxxx | Roguelike 自定义状态 |
| 9000001+ | PvE 通用状态（pve.ts） |
| 2900xx | Roguelike 自定义天赋牌 |

---

## 13. 自定义事件指南

### 13.1 添加新事件

在 `default-events.ts` 的 `DEFAULT_EVENTS` 数组中添加（`data.ts` 会重新导出以保持兼容）：

```typescript
{
  id: 2017,  // 唯一 ID，建议 2001-2999 范围
  name: "神秘旅人",
  imageUrl: "/events/2017_traveler.webp",
  storyTemplate: "{{playerNames}} 在路上遇到了一位神秘的旅人……",
  conditionMode: "or",  // 可选，默认 "or"
  conditions: [
    { condition: { type: "floorAtLeast", floor: 2 }, weight: 3 },
    { condition: { type: "hasCard", cardId: 332001, minCount: 2 }, weight: 2 },
  ],
  effects: [
    { type: "addCurrency", amount: 10 },
    { type: "randomCard", tag: "food", count: 2 },
  ],
}
```

### 13.2 条件类型速查

```typescript
// 卡牌相关
{ type: "hasCard", cardId: 332001, minCount?: 1 }       // 检查指定卡牌数量
{ type: "hasAnyCards", cardIds: [332001, 333006] }       // 检查是否拥有列表中任意一张

// 角色相关
{ type: "hasCharacterTag", tag: "pyro", minCount?: 1 }
{ type: "hasCharacter", characterId: 1501 }
{ type: "hasAllCharacters", characterIds: [1501, 1701] }
{ type: "noCharacter", characterId: 1501 }
{ type: "teamOnlyElements", elements: ["pyro", "electro"] }

// 进度相关
{ type: "defeatedEnemy", enemyId: 2102 }
{ type: "floorAtLeast", floor: 2 }
{ type: "currencyAtLeast", amount: 20 }
{ type: "deckSizeAtLeast", count: 10 }
{ type: "teamSizeAtLeast", count: 3 }
{ type: "teamSizeAtMost", count: 2 }

// 事件相关
{ type: "anyEventCompleted", eventIds: [2001, 2002] }
{ type: "noEventCompleted", eventIds: [2001] }
```

### 13.3 效果类型速查

```typescript
{ type: "addCurrency", amount: 10 }
{ type: "removeCurrency", amount: 5 }
{ type: "addCard", cardId: 332001, count?: 2 }
{ type: "removeCard", cardId: 333006, count?: 1 }
{ type: "randomCard", tag: "food", count?: 1 }
{ type: "chooseAndRemoveCard" }  // UI 层处理，玩家选择删哪张
{ type: "modifyCharacterMaxHp", characterId?: 1501, amount: 3 }
{ type: "addCharacter", characterId: 1501 }
{ type: "modifyNextBattleAllyHp", amount: 5 }
{ type: "modifyNextBattleEnemyHp", amount: -3 }
{ type: "skipNextNormalBattle" }
```

### 13.4 回退事件

如需将某事件加入回退池（无条件触发的兜底），在 `default-events.ts` 的 `FALLBACK_EVENT_IDS` 集合中添加其 ID。回退事件可重复触发，不计入 `completedEventIds`。

```typescript
const FALLBACK_EVENT_IDS = new Set([2999]);  // 添加新 ID 即可
```

### 13.5 模板变量

在 `storyTemplate` 中使用 `{{variable}}` 语法，支持的变量见 [8.3 模板变量](#83-模板变量)。

---

## 14. 自定义卡牌效果指南

### 14.1 覆盖现有卡牌

在 `packages/roguelike-data/src/overrides/` 中定义增强版卡牌：

```typescript
// 使用与原卡相同的 ID，setVersionInfo("roguelike") 标记为 roguelike 版本
export const EnhancedCard = card(原卡ID)
  .setVersionInfo("roguelike", {})
  .costVoid(2)
  // ... 新效果
  .done();
```

### 14.2 添加全新的 PvE 专用状态

在 `packages/data/src/pve.ts` 中定义：

```typescript
export const MyPvEStatus = status(9000003)
  .on("某个事件触发器")
  .usageCanAppend(1, 5)  // 可叠加 1-5 层
  .do((c, e) => {
    // 效果逻辑
  })
  .done();
```

然后在 `modifier-resolver.ts` 的解析器表中引用。

### 14.3 已知 Bug：PvE 状态不可使用自定义变量

在 `pve.ts` 中为 PvE 状态（ID 9000001+）添加自定义变量（`.variable()` 或 `variableCanAppend()`）会导致引擎中其他角色的 skill 在 `onAction` 事件中报错：

```
c.eventArg[prop] is not a function
```

**复现条件：**
- 在 `pve.ts` 中定义 status(90000xx) 并调用 `.variable("anyName", anyValue)`
- 任意角色装备带有 `onAction` 触发器的天赋/武器（如 extension 50323006）
- 切换出战角色时触发该 skill

**排查结论：**

| 实验 | 结果 |
|------|------|
| `usageCanAppend` + 硬编码 `.increaseDamage(1)` | ✅ 正常 |
| `.variable("x", 1)` + 硬编码 | ❌ 报错 |
| `variableCanAppend("x", 1, Infinity)` | ❌ 报错 |
| 换变量名 / 去掉 `{ visible: false }` | ❌ 仍报错 |

变量名、选项、是否搭配 `usageCanAppend` 均无关——只要给 PvE 状态加任何自定义变量就会触发。

**影响：** 无法实现双参数（可变 amount + 可变 count）的伤害增加/减免状态。当前只能使用单参数（count），amount 固定为 ±1。

**可能原因：** builder 的 `status().done()` 注册流程中，`varConfigs` 可能意外污染了全局状态，影响后续注册的实体定义。需要深入排查 `@gi-tcg/core` 的 `EntityBuilder` 和 `TriggeredSkillBuilder` 的交互。

**临时规避：** PvE 状态只使用 `usageCanAppend` + 硬编码数值，不使用 `.variable()` 或 `variableCanAppend()`。

---

## 15. 敌人脚本与 AI

### 15.1 当前 AI 策略

`createSimpleAI()` 使用固定优先级：

```
1. 被控制（有技能但全部不可用）→ 强制切人
2. switchAfterSkill 阶段 → 切人（放完技能后轮转到下一个角色）
3. 打出手牌（打出第一张可用手牌）
4. 使用技能：元素爆发 > 元素战技 > 普通攻击
5. 未切过人 → 切人（轮转到下一个角色）
6. 结束回合
```

**切人策略：** 按角色 ID 升序排列后 round-robin 轮转。通过插入点算法实现：在排序列表中找最后一个 `< activeCharacterId` 的位置，取下一个位置作为目标（回绕到最小 ID）。跳过已倒下的角色。

示例：`sorted=[101,103,105], active=103 → 目标=105`；`active=105 → 目标=101`（回绕）。

### 15.2 自定义 AI（未来扩展）

如需更智能的 AI，可以：

1. 实现 `PlayerIO` 接口：
```typescript
const myAI: PlayerIO = {
  notify: (notification) => { /* 处理游戏状态通知 */ },
  rpc: dispatchRpc({
    chooseActive: async (req) => ({ activeCharacterId: /* 选择逻辑 */ }),
    action: async (req) => {
      // 分析 req.action[] 中的可用行动
      // 返回 { chosenActionIndex, usedDice }
    },
    // ...
  }),
};
```

2. 在 `run.ts.createBattleGame()` 中替换：
```typescript
game.players[1].io = myAI;  // 替换 createSimpleAI()
```

---

## 16. 测试指南

### 16.1 运行测试

```sh
cd packages/roguelike
pnpm test                    # 运行所有测试
pnpm vitest run __tests__/events.test.ts  # 运行单个测试文件
```

### 16.2 测试覆盖范围

| 测试文件 | 覆盖内容 |
|----------|----------|
| `run.test.ts` | 状态机转换、角色选择、战斗结算、奖励、商店 |
| `events.test.ts` | 条件评估（15 种）、效果应用（11 种）、模板渲染、权重选择 |
| `ai.test.ts` | 行动优先级、切人逻辑、RPC 接口 |
| `modifier-resolver.test.ts` | 所有 9 种修饰器解析、批量解析、ID 偏移 |
| `card-weights.test.ts` | 权重操作、Dijkstra 传递、扩散算法、统计分布 |
| `encounters.test.ts` | HP 公式、经济公式、初始卡组、商店抽卡 |
| `weight-verify.mts` | 权重系统手动验证脚本（基础操作、传递性、扩散、统计分布） |

### 16.3 编写新测试

```typescript
// __tests__/my_feature.test.ts
import { describe, it, expect } from "vitest";
import { /* 需要测试的函数 */ } from "../src";

describe("my feature", () => {
  it("should do something", () => {
    // 准备测试数据
    // 调用函数
    // 断言结果
  });
});
```

---

## 17. 代码规范

### 17.1 命名规范

- **类型/接口：** PascalCase (`RoguelikeRun`, `EnemyConfig`)
- **函数/变量：** camelCase (`generateCardPool`, `currentNodeIndex`)
- **常量：** SCREAMING_SNAKE_CASE (`MAX_TEAM_SIZE`, `BASE_HP`)
- **文件：** kebab-case (`card-weights.ts`, `modifier-resolver.ts`)

### 17.2 注释规范

- 所有用户可见字符串使用中文
- 代码注释使用中文（技术术语可用英文）
- JSDoc 注释用于公共 API
- 判别联合类型的每个分支应有中文注释

### 17.3 新增修饰器清单

添加新修饰器类型时需要修改：

1. `types.ts` — `EnemyModifierType` 联合类型 + `EnemyModifier` 联合类型
2. `modifier-resolver.ts` — `ENTITY_RESOLVERS` 解析器表或独立分支
3. `data.ts` — `KNOWN_STATUS_IDS`（如需新状态 ID）
4. `data/src/pve.ts` — 状态定义（如需 PvE 专用状态）
5. `EnemyEditor.tsx` — `MODIFIER_LABELS` + `MODIFIER_VALUE_TYPE`
6. 测试文件 — `modifier-resolver.test.ts`

### 17.4 新增事件条件/效果清单

添加新条件/效果类型时需要修改：

1. `types.ts` — `EventConditionType` 或 `EventEffectType` 联合类型
2. `events.ts` — `getMatchCount()`（条件）或 `applyEventEffects()`（效果）
3. `standalone/src/event-descriptors.ts` — `CONDITION_DESCRIPTORS` 或 `EFFECT_DESCRIPTORS`（已从 roguelike 包迁移至 standalone）
4. `EventEditor.tsx` — 如需新的编辑器字段类型
5. 测试文件 — `events.test.ts`
