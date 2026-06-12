import { For, Show, createMemo, createSignal } from "solid-js";
import getData from "@gi-tcg/data";
import { CURRENT_VERSION } from "@gi-tcg/core";
import {
  generateCardPool,
  rollShopCards,
  analyzeRelationships,
  createEncounter,
  DEFAULT_SHOP_CARD_COST,
  type RoguelikeRunManager,
  type Encounter,
  type CharacterPoolEntry,
  type EnemyConfig,
} from "@gi-tcg/roguelike";
import { configStore } from "./configStore";
import { DebugRunController } from "./debug-run-controller";
import { SafeImage } from "./SafeImage";
import { useDragSelect } from "./useDragSelect";
import { EntityGrid } from "./EntityGrid";
import { CardWeightEditor } from "./CardWeightEditor";
import { EnemyEditor } from "./EnemyEditor";
import { LevelEditor } from "./LevelEditor";
import { EventEditor } from "./EventEditor";
import { OverlayPanel } from "./OverlayPanel";
import { NumberInput } from "./NumberInput";

const data = getData(CURRENT_VERSION);

/** 从敌人池构建全部遭遇列表 */
function buildEncounters() {
  const pool = configStore.enemyPool();
  return [
    ...pool.normal.map((c: EnemyConfig) => createEncounter("normal", c)),
    ...pool.elite.map((c: EnemyConfig) => createEncounter("elite", c)),
    ...pool.boss.map((c: EnemyConfig) => createEncounter("boss", c)),
  ];
}

export interface DebugPanelProps {
  characterPool: CharacterPoolEntry[];
  runManager: () => RoguelikeRunManager;
  onCreateRunManager: () => void;
  onSetDebugMode: (mode: "off" | "manual" | "autoWin") => void;
  onSetViewMode: (mode: "home" | "game") => void;
  onSetTestBattleMode: (v: boolean) => void;
  onStartGame: () => void;
  /** 遭遇选择时的调试回调（自动胜利模式下自动结束战斗） */
  onDebugSelectEncounter?: (encounter: Encounter) => void;
}

export function DebugPanel(props: DebugPanelProps) {
  const ctrl = () => new DebugRunController(props.runManager());
  // 测试配置
  const [testChars, setTestChars] = createSignal<number[]>([]);
  // 从关卡编辑全局参数读取初始货币和商店卡数
  const levelConfig = configStore.levelConfig;

  // 面板展开/折叠状态
  const [showPanel, setShowPanel] = createSignal(false);

  // 编辑器弹窗状态（互斥，同一时间只能打开一个）
  type PanelId = "cardPool" | "enemyEditor" | "levelEditor" | "cardWeights" | "eventEditor";
  const [activePanel, setActivePanel] = createSignal<PanelId | null>(null);

  // 卡池查看器状态
  const cardCosts = configStore.cardCosts;
  const setCardCosts = (costs: Record<number, number>) => configStore.setCardCosts(costs);
  const [selectedCards, setSelectedCards] = createSignal<Set<number>>(new Set());
  const [batchCost, setBatchCost] = createSignal(DEFAULT_SHOP_CARD_COST);
  const [cardPoolMultiSelect, setCardPoolMultiSelect] = createSignal(false);

  /** 切换卡池多选中的卡牌选中状态 */
  const togglePoolCard = (cardId: number) => {
    const s = new Set(selectedCards());
    s.has(cardId) ? s.delete(cardId) : s.add(cardId);
    setSelectedCards(s);
  };

  // 卡池网格拖拽选择
  const poolDrag = useDragSelect({
    guard: () => cardPoolMultiSelect(),
    resolveId: (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el) return null;
      const item = el.closest("[data-card-id]") as HTMLElement | null;
      if (!item) return null;
      return Number(item.dataset.cardId) || null;
    },
    isSelected: (id) => selectedCards().has(id),
    toggle: togglePoolCard,
  });

  /** 当前测试角色组合下的卡池（响应式缓存） */
  const testCardPool = createMemo(() => generateCardPool(data, testChars(), 4));

  /** 自动分析的卡牌关系建议（只计算一次） */
  const suggestedPairs = createMemo(() => analyzeRelationships());

  /** 初始化测试 run，返回角色数组（失败返回 null） */
  function ensureDebugReady(currency?: number): number[] | null {
    const chars = testChars();
    if (chars.length < 2) { alert("至少选择 2 个角色"); return null; }
    // 重建 runManager 确保使用最新的关卡配置（利息、商店卡数等）
    props.onCreateRunManager();
    ctrl().quickStart(chars, currency ?? levelConfig().initialCurrency);
    return chars;
  }

  /** 测试战斗：直接跳到第一个战斗节点，跳过事件和路径图 */
  const testBattle = () => {
    if (!ensureDebugReady()) return;
    const rm = props.runManager();
    const run = rm.getRun();
    // 找到第一个战斗节点（normal/elite/boss）
    const battleNodeIdx = run.path.findIndex((n) => n.type === "normal" || n.type === "elite" || n.type === "boss");
    if (battleNodeIdx < 0) {
      alert("当前关卡没有战斗节点！");
      return;
    }
    ctrl().setRun({ currentNodeIndex: battleNodeIdx, state: "encounterSelect" });
    props.onSetTestBattleMode(true);
    props.onSetDebugMode("manual");
    props.onSetViewMode("game");
  };

  /** 测试流程：正常流程 + 自动胜利 */
  const testFullFlow = () => {
    if (!ensureDebugReady()) return;
    props.onSetTestBattleMode(false);
    props.onSetDebugMode("autoWin");
    props.onSetViewMode("game");
  };

  const testShop = () => {
    if (!ensureDebugReady()) return;
    const rm = props.runManager();
    const run = rm.getRun();
    const items = rollShopCards(levelConfig().shopCardCount, { data, characterIds: run.characters, floor: run.floor, deck: run.deck, cardCosts: cardCosts() });
    ctrl().setRun({ state: "shop", shopItems: items, refreshCount: 0 });
    props.onSetTestBattleMode(false);
    props.onSetDebugMode("manual");
    props.onSetViewMode("game");
  };

  const testReward = () => {
    if (!ensureDebugReady()) return;
    const encounter = buildEncounters()[0];
    ctrl().setRun({ currentEncounter: encounter, state: "battle" });
    props.runManager().onBattleEnd(0);
    props.onSetTestBattleMode(false);
    props.onSetDebugMode("manual");
    props.onSetViewMode("game");
  };

  /** 切换测试角色选择 */
  function toggleTestChar(id: number) {
    const chars = testChars();
    if (chars.includes(id)) {
      setTestChars(chars.filter((c) => c !== id));
    } else if (chars.length < 4) {
      setTestChars([...chars, id]);
    }
  }

  /** 展开面板时初始化默认角色 */
  function expandPanel() {
    setShowPanel(true);
    // 首次展开时从角色池中选取前两个作为默认角色
    const pool = props.characterPool;
    if (pool.length >= 2 && testChars().length === 0) {
      setTestChars([pool[0].id, pool[1].id]);
    }
  }

  return (
    <>
      <div class="pve-debug-panel">
        <button class="pve-debug-toggle" onClick={() => showPanel() ? setShowPanel(false) : expandPanel()}>
          ⚙️ 测试/编辑 {showPanel() ? "▲" : "▼"}
        </button>

        <Show when={showPanel()}>
        {/* 角色选择 */}
        <div class="pve-debug-section">
          <h3>选择角色（点击切换，最多 4 个）</h3>
          <EntityGrid
            items={props.characterPool}
            mode="multi"
            selected={new Set(testChars())}
            maxSelect={4}
            onChange={(_id, sel) => setTestChars([...sel!])}
            class="pve-debug-char-grid"
            itemClass="pve-debug-char"
          />
          <p class="pve-debug-hint">已选: {testChars().map((id) => props.characterPool.find((c) => c.id === id)?.name ?? id).join(", ")}</p>
        </div>

        {/* 测试按钮 */}
        <div class="pve-debug-actions">
          <button class="editor-btn editor-btn-blue" onClick={testBattle}>⚔️ 测试战斗</button>
          <button class="editor-btn editor-btn-blue" onClick={testShop}>🏪 测试商店</button>
          <button class="editor-btn editor-btn-blue" onClick={testReward}>🎁 测试奖励</button>
          <button class="editor-btn editor-btn-blue" onClick={testFullFlow}>🔄 测试流程</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setActivePanel(activePanel() === "cardPool" ? null : "cardPool")}>🃏 费用编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setActivePanel("enemyEditor")}>👾 怪物编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setActivePanel("levelEditor")}>🗺️ 关卡编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setActivePanel("cardWeights")}>⚖️ 权重编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setActivePanel("eventEditor")}>📜 事件编辑</button>
        </div>

        {/* 卡池查看器 */}
        <Show when={activePanel() === "cardPool"}>
          <OverlayPanel title="🃏 费用编辑" onClose={() => setActivePanel(null)}>
            <div class="pve-cardpool">
              <h3>当前卡池（{testCardPool().length} 张）</h3>
              <div class="pve-cardpool-actions">
                <Show when={!cardPoolMultiSelect()}>
                  <button class="editor-btn" onClick={() => { setCardPoolMultiSelect(true); setSelectedCards(new Set<number>()); }}>☑ 多选模式</button>
                </Show>
                <Show when={cardPoolMultiSelect()}>
                  <span>已选: {selectedCards().size} 张</span>
                  <button class="editor-btn" onClick={() => {
                    if (selectedCards().size === testCardPool().length) {
                      setSelectedCards(new Set<number>());
                    } else {
                      setSelectedCards(new Set<number>(testCardPool().map((c) => c.cardId)));
                    }
                  }}>{selectedCards().size === testCardPool().length ? "取消全选" : "全选"}</button>
                  <label>
                    设定费用:
                    <NumberInput value={batchCost()} min={1} max={10} onChange={setBatchCost} class="pve-batch-cost-input" />
                  </label>
                  <button class="editor-btn editor-btn-save" onClick={() => {
                    const costs = { ...cardCosts() };
                    for (const id of selectedCards()) costs[id] = batchCost();
                    setCardCosts(costs);
                  }}>应用</button>
                  <button class="editor-btn" onClick={() => { setCardPoolMultiSelect(false); setSelectedCards(new Set<number>()); }}>退出多选</button>
                </Show>
              </div>
              <div class="card-grid pve-cardpool-grid"
                onPointerDown={poolDrag.onPointerDown}
                onPointerUp={poolDrag.onPointerUp}
                onPointerLeave={poolDrag.onPointerLeave}
                onPointerMove={poolDrag.onPointerMove}
              >
                <For each={testCardPool()}>
                  {(card) => {
                    const isSelected = () => selectedCards().has(card.cardId);
                    const cost = () => cardCosts()[card.cardId];
                    return (
                      <div class={`card-item pve-cardpool-item ${isSelected() ? "card-item-selected pve-cardpool-item-selected" : ""}`}
                        data-card-id={card.cardId}
                      >
                        <SafeImage entityId={card.cardId} alt={card.name} loading="lazy" />
                        <span>{card.name}</span>
                        <span class="pve-cardpool-cost">💰{cost() ?? DEFAULT_SHOP_CARD_COST}</span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </OverlayPanel>
        </Show>
        </Show>
      </div>

      {/* 编辑器弹窗 */}
      <Show when={activePanel() === "enemyEditor"}>
        <EnemyEditor
          onSave={() => props.onCreateRunManager()}
          onClose={() => setActivePanel(null)}
        />
      </Show>

      <Show when={activePanel() === "levelEditor"}>
        <LevelEditor
          onSave={() => props.onCreateRunManager()}
          onClose={() => setActivePanel(null)}
        />
      </Show>

      <Show when={activePanel() === "cardWeights"}>
        <OverlayPanel title="⚖️ 权重编辑" onClose={() => setActivePanel(null)}>
          <CardWeightEditor cardPool={testCardPool()} characterPool={props.characterPool} suggestedPairs={suggestedPairs()} />
        </OverlayPanel>
      </Show>

      <Show when={activePanel() === "eventEditor"}>
        <EventEditor
          mode="standalone"
          onSave={() => props.onCreateRunManager()}
          onClose={() => setActivePanel(null)}
          onTestEvent={(event) => {
            props.onCreateRunManager();
            ctrl().enterEvent(event, testChars(), () => {
              // 事件确认后返回事件编辑器
              props.onSetViewMode("home");
              props.onSetDebugMode("off");
              setActivePanel("eventEditor");
            });
            props.onSetDebugMode("manual");
            props.onSetViewMode("game");
            setActivePanel(null);
          }}
        />
      </Show>
    </>
  );
}
