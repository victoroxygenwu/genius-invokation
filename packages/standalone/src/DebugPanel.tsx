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
import { getEnemyPool, configStore } from "./configStore";
import { SafeImage } from "./SafeImage";
import { CardWeightEditor } from "./CardWeightEditor";
import { EnemyEditor } from "./EnemyEditor";
import { LevelEditor } from "./LevelEditor";
import { EventTestPanel } from "./EventTestPanel";
import { OverlayPanel } from "./OverlayPanel";
import { NumberInput } from "./NumberInput";

const data = getData(CURRENT_VERSION);

/** 从敌人池构建全部遭遇列表 */
function buildEncounters() {
  const pool = getEnemyPool();
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
  onStartGame: () => void;
  /** 遭遇选择时的调试回调（自动胜利模式下自动结束战斗） */
  onDebugSelectEncounter?: (encounter: Encounter) => void;
}

export function DebugPanel(props: DebugPanelProps) {
  // 测试配置
  const [testChars, setTestChars] = createSignal<number[]>([]);
  // 从关卡编辑全局参数读取初始货币和商店卡数
  const levelConfig = configStore.levelConfig;

  // 面板展开/折叠状态
  const [showPanel, setShowPanel] = createSignal(false);
  // 首次展开时初始化默认角色
  const [charsInitialized, setCharsInitialized] = createSignal(false);

  // 编辑器弹窗状态
  const [showCardPool, setShowCardPool] = createSignal(false);
  const [showEnemyEditor, setShowEnemyEditor] = createSignal(false);
  const [showLevelEditor, setShowLevelEditor] = createSignal(false);
  const [showCardWeightEditor, setShowCardWeightEditor] = createSignal(false);
  const [showEventTestPanel, setShowEventTestPanel] = createSignal(false);

  // 卡池查看器状态
  const cardCosts = configStore.cardCosts;
  const setCardCosts = (costs: Record<number, number>) => configStore.setCardCosts(costs);
  const [selectedCards, setSelectedCards] = createSignal<Set<number>>(new Set());
  const [batchCost, setBatchCost] = createSignal(DEFAULT_SHOP_CARD_COST);
  const [cardPoolMultiSelect, setCardPoolMultiSelect] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  /** 拖动方向："select" = 拖动选中，"deselect" = 拖动取消选中 */
  const [dragAction, setDragAction] = createSignal<"select" | "deselect" | null>(null);

  /** 切换卡池多选中的卡牌选中状态 */
  const togglePoolCard = (cardId: number) => {
    const s = new Set(selectedCards());
    s.has(cardId) ? s.delete(cardId) : s.add(cardId);
    setSelectedCards(s);
  };

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
    props.runManager().debugQuickStart(chars, currency ?? levelConfig().initialCurrency);
    return chars;
  }

  /** 进入测试模式（选敌人界面） */
  function enterDebugBattle(autoWin: boolean) {
    if (!ensureDebugReady()) return;
    props.onSetDebugMode(autoWin ? "autoWin" : "manual");
    props.onSetViewMode("game");
  }

  const testBattle = () => enterDebugBattle(false);
  const testFullFlow = () => enterDebugBattle(true);

  const testShop = () => {
    if (!ensureDebugReady()) return;
    const rm = props.runManager();
    const run = rm.getRun();
    const items = rollShopCards(levelConfig().shopCardCount, { data, characterIds: run.characters, floor: run.floor, deck: run.deck, cardCosts: cardCosts() });
    rm.debugSetRun({ state: "shop", shopItems: items, refreshCount: 0 });
    props.onSetDebugMode("manual");
    props.onSetViewMode("game");
  };

  const testReward = () => {
    if (!ensureDebugReady()) return;
    props.runManager().debugSetRun({ currentEncounter: buildEncounters()[0], state: "battle" });
    props.runManager().onBattleEnd(0);
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
    if (!charsInitialized()) {
      setCharsInitialized(true);
      // 从角色池中选取前两个作为默认角色
      const pool = props.characterPool;
      if (pool.length >= 2 && testChars().length === 0) {
        setTestChars([pool[0].id, pool[1].id]);
      }
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
          <div class="card-grid pve-debug-char-grid">
            <For each={props.characterPool}>
              {(char) => (
                <button
                  class={`card-item pve-debug-char ${testChars().includes(char.id) ? "pve-debug-char-selected" : ""}`}
                  onClick={() => toggleTestChar(char.id)}
                >
                  <SafeImage entityId={char.id} alt={char.name} loading="lazy" />
                  <span>{char.name}</span>
                </button>
              )}
            </For>
          </div>
          <p class="pve-debug-hint">已选: {testChars().map((id) => props.characterPool.find((c) => c.id === id)?.name ?? id).join(", ")}</p>
        </div>

        {/* 测试按钮 */}
        <div class="pve-debug-actions">
          <button class="editor-btn editor-btn-blue" onClick={testBattle}>⚔️ 测试战斗</button>
          <button class="editor-btn editor-btn-blue" onClick={testShop}>🏪 测试商店</button>
          <button class="editor-btn editor-btn-blue" onClick={testReward}>🎁 测试奖励</button>
          <button class="editor-btn editor-btn-blue" onClick={testFullFlow}>🔄 测试流程</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setShowCardPool(!showCardPool())}>🃏 费用编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setShowEnemyEditor(true)}>👾 怪物编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setShowLevelEditor(true)}>🗺️ 关卡编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => setShowCardWeightEditor(true)}>⚖️ 权重编辑</button>
          <button class="editor-btn editor-btn-blue" onClick={() => {
            if (!ensureDebugReady()) return;
            props.onSetDebugMode("manual");
            props.onSetViewMode("game");
            setShowEventTestPanel(true);
          }}>📜 测试事件</button>
        </div>

        {/* 卡池查看器 */}
        <Show when={showCardPool()}>
          <OverlayPanel title="🃏 费用编辑" onClose={() => setShowCardPool(false)}>
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
                onMouseDown={(e) => {
                  if (!cardPoolMultiSelect()) return;
                  const el = (e.target as HTMLElement).closest("[data-card-id]") as HTMLElement | null;
                  if (!el) return;
                  const cardId = Number(el.dataset.cardId);
                  if (!cardId) return;
                  setIsDragging(true);
                  const wasSelected = selectedCards().has(cardId);
                  setDragAction(wasSelected ? "deselect" : "select");
                  togglePoolCard(cardId);
                }}
                onMouseUp={() => { setIsDragging(false); setDragAction(null); }}
                onMouseLeave={() => { setIsDragging(false); setDragAction(null); }}
                onMouseMove={(e) => {
                  if (!isDragging() || !cardPoolMultiSelect()) return;
                  const el = (e.target as HTMLElement).closest("[data-card-id]") as HTMLElement | null;
                  if (!el) return;
                  const cardId = Number(el.dataset.cardId);
                  if (!cardId) return;
                  const isSelected = selectedCards().has(cardId);
                  if (dragAction() === "select" && !isSelected) {
                    togglePoolCard(cardId);
                  } else if (dragAction() === "deselect" && isSelected) {
                    togglePoolCard(cardId);
                  }
                }}
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
      <Show when={showEnemyEditor()}>
        <EnemyEditor
          onSave={() => props.onCreateRunManager()}
          onClose={() => setShowEnemyEditor(false)}
        />
      </Show>

      <Show when={showLevelEditor()}>
        <LevelEditor
          onSave={() => props.onCreateRunManager()}
          onClose={() => setShowLevelEditor(false)}
        />
      </Show>

      <Show when={showCardWeightEditor()}>
        <OverlayPanel title="⚖️ 权重编辑" onClose={() => setShowCardWeightEditor(false)}>
          <CardWeightEditor cardPool={testCardPool()} characterPool={props.characterPool} suggestedPairs={suggestedPairs()} />
        </OverlayPanel>
      </Show>

      <Show when={showEventTestPanel()}>
        <EventTestPanel
          runManager={props.runManager}
          onClose={() => setShowEventTestPanel(false)}
        />
      </Show>
    </>
  );
}
