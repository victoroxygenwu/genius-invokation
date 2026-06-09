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

import getData from "@gi-tcg/data";
import { CURRENT_VERSION, setAsyncContext } from "@gi-tcg/core";
import { createClient } from "@gi-tcg/web-ui-core";
import "@gi-tcg/web-ui-core/style.css";
import { PbPhaseType } from "@gi-tcg/typings";
import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on, type JSX } from "solid-js";
import {
  RoguelikeRunManager,
  ENCOUNTER_CURRENCY,
  getImageUrl,
  FALLBACK_IMAGE,
  getCardName,
  generateCharacterPool,
  NORMAL_ENCOUNTERS,
  ELITE_ENCOUNTERS,
  BOSS_ENCOUNTERS,
  generateCardPool,
  analyzeRelationships,
  type RoguelikeRun,
  type Encounter,
  type NodeType,
  type RunState,
  type CharacterPoolEntry,
} from "@gi-tcg/roguelike";
import { CardWeightEditor } from "./CardWeightEditor";
import "./pve-style.css";

// ============================================================
// 子组件
// ============================================================

/** 角色选择网格（开局选人 / 追加角色共用） */
function CharacterGrid(props: {
  characters: CharacterPoolEntry[];
  onSelect: (id: number) => void;
  extraClass?: string;
}) {
  return (
    <div class="pve-character-grid">
      <For each={props.characters}>
        {(char) => (
          <button class="pve-character-card" onClick={() => props.onSelect(char.id)}>
            <img class="pve-character-img" src={getImageUrl(char.id)} alt={char.name} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
            <div class="pve-character-name">{char.name}</div>
            <div class="pve-character-element">{char.element}</div>
          </button>
        )}
      </For>
    </div>
  );
}

/** 商店中的卡组管理区域 */
function ShopDeckSection(props: {
  deck: number[];
  deletingIndex: number;
  onDelete: (i: number) => void;
  onCancel: () => void;
}) {
  return (
    <div class="pve-deck-section">
      <h3>当前卡组 ({props.deck.length} 张)</h3>
      <div class="pve-deck-items">
        <For each={props.deck}>
          {(cardId, index) => (
            <button
              class={`pve-deck-item ${props.deletingIndex === index() ? "pve-deck-item-deleting" : ""}`}
              onClick={() => props.onDelete(index())}
            >
              <img class="pve-deck-img" src={getImageUrl(cardId)} alt={getCardName(cardId)} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
              <div class="pve-deck-name">{getCardName(cardId)}</div>
              <Show when={props.deletingIndex === index()}>
                <div class="pve-deck-confirm">再点确认删除</div>
              </Show>
            </button>
          )}
        </For>
      </div>
      <Show when={props.deletingIndex >= 0}>
        <button class="pve-deck-cancel" onClick={props.onCancel}>取消删除</button>
      </Show>
    </div>
  );
}

const NODE_ICON: Record<NodeType, string> = {
  normal: "⚔️", elite: "💀", shop: "🏪", boss: "👹",
};

const data = getData(CURRENT_VERSION);
const CHARACTER_POOL = generateCharacterPool(data).sort((a, b) => a.id - b.id);

/** 所有可用敌人（用于测试选敌） */
const ALL_ENCOUNTERS = [...NORMAL_ENCOUNTERS, ...ELITE_ENCOUNTERS, ...BOSS_ENCOUNTERS];

type DebugMode = "off" | "manual" | "autoWin";
const DEBUG_INF_CURRENCY = 9999;

export interface PvEModeProps {
  onBack?: () => void;
}

export function PvEMode(props: PvEModeProps) {
  const [runManager] = createSignal(new RoguelikeRunManager(data));
  const [run, setRun] = createSignal<RoguelikeRun>(runManager().getRun());
  const [selectedReward, setSelectedReward] = createSignal<number>(-1);
  const [inBattle, setInBattle] = createSignal(false);
  const [showDeck, setShowDeck] = createSignal(false);
  const [deletingIndex, setDeletingIndex] = createSignal<number>(-1);

  // 首页 / 游戏视图切换
  const [viewMode, setViewMode] = createSignal<"home" | "game">("home");

  // 测试面板配置
  const [testChars, setTestChars] = createSignal<number[]>([1101, 1503]);
  const [testCurrency, setTestCurrency] = createSignal(100);
  const [showCardPool, setShowCardPool] = createSignal(false);
  const [debugMode, setDebugMode] = createSignal<DebugMode>("off");

  const [uiIo, Chessboard, boardData] = createClient(0);

  // 响应式检测游戏结束（替代轮询）
  const [gameEndTrigger, setGameEndTrigger] = createSignal(0);
  createEffect(on(
    () => boardData().state.phase,
    (phase) => { if (phase === PbPhaseType.GAME_END) setGameEndTrigger((n) => n + 1); },
  ));

  runManager().setOnUpdate((newRun) => setRun(newRun));

  const [pendingFirst, setPendingFirst] = createSignal(false);
  const selectFirstCharacter = (id: number) => {
    runManager().selectFirstCharacter(id);
    setPendingFirst(true);
  };
  const selectSecondCharacter = (id: number) => {
    runManager().selectSecondCharacter(id);
    setPendingFirst(false);
  };
  const addCharacter = (id: number) => runManager().addCharacter(id);
  const selectEncounter = (index: number) => runManager().selectEncounter(index);

  const startBattle = async () => {
    const encounter = run().currentEncounter;
    if (!encounter) return;
    setInBattle(true);
    try {
      const { game, playerWho } = runManager().createBattleGame(encounter);
      game.players[playerWho].io = uiIo;
      await setAsyncContext(true);
      const winner = await game.start();
      // 等待 UI 渲染到 GAME_END 阶段（响应式 + 30s 超时）
      const currentTrigger = gameEndTrigger();
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 30_000);
        const check = setInterval(() => {
          if (gameEndTrigger() !== currentTrigger) {
            clearInterval(check);
            clearTimeout(timeout);
            setTimeout(resolve, 1000);
          }
        }, 100);
      });
      runManager().onBattleEnd(winner === 0 ? 0 : 1);
    } catch (e) {
      console.error("Battle error:", e);
      alert(`战斗出错: ${e instanceof Error ? e.message : String(e)}`);
      runManager().onBattleEnd(1);
    } finally {
      setInBattle(false);
    }
  };

  const claimReward = () => {
    const idx = selectedReward();
    if (idx < 0) return;
    runManager().claimRewardAndFinish(idx);
    setSelectedReward(-1);
  };

  const buyCard = (index: number) => {
    if (!runManager().buyCard(index)) {
      alert("费用不足！");
    }
  };
  const refreshShop = () => {
    if (!runManager().refreshShop()) {
      alert("费用不足！");
    }
  };
  const deleteCard = (i: number) => {
    const cost = runManager().getDeleteCost();
    if (run().currency < cost) {
      alert("费用不足！");
      return;
    }
    if (deletingIndex() === i) {
      // 第二次点击，确认删除
      runManager().deleteCard(i);
      setDeletingIndex(-1);
    } else {
      // 第一次点击，标记为待删除
      setDeletingIndex(i);
    }
  };
  const cancelDelete = () => setDeletingIndex(-1);
  const finishShop = () => { setDeletingIndex(-1); runManager().finishShop(); };
  const restart = () => { runManager().restart(); setPendingFirst(false); setDeletingIndex(-1); };

  // ============================================================
  // 首页导航
  // ============================================================
  const goHome = () => { restart(); setViewMode("home"); setDebugMode("off"); };
  const startGame = () => { restart(); setViewMode("game"); setDebugMode("off"); };

  // ============================================================
  // 测试快捷入口
  // ============================================================

  /** 初始化测试 run，返回角色数组（失败返回 null） */
  function ensureDebugReady(currency = testCurrency()): number[] | null {
    const chars = testChars();
    if (chars.length < 2) { alert("至少选择 2 个角色"); return null; }
    runManager().debugQuickStart(chars, currency);
    return chars;
  }

  /** 进入测试模式（选敌人界面） */
  function enterDebugBattle(autoWin: boolean) {
    if (!ensureDebugReady()) return;
    setDebugMode(autoWin ? "autoWin" : "manual");
    setViewMode("game");
  }

  const testBattle = () => enterDebugBattle(false);
  const testFullFlow = () => enterDebugBattle(true);

  const testShop = () => {
    if (!ensureDebugReady(DEBUG_INF_CURRENCY)) return;
    runManager().debugSetRun({ state: "shop", shopItems: [], refreshCount: 0 });
    runManager().refreshShop();
    setDebugMode("manual");
    setViewMode("game");
  };

  const testReward = () => {
    if (!ensureDebugReady()) return;
    runManager().debugSetRun({ currentEncounter: NORMAL_ENCOUNTERS[0], state: "battle" });
    runManager().onBattleEnd(0);
    setDebugMode("manual");
    setViewMode("game");
  };

  const testRewardRefresh = () => runManager().onBattleEnd(0);

  function debugSelectEncounter(encounter: Encounter) {
    runManager().debugSetRun({ currentEncounter: encounter, state: "battle" });
    if (debugMode() === "autoWin") {
      runManager().onBattleEnd(0);
    }
  }

  /** 切换测试角色选择 */
  function toggleTestChar(id: number) {
    const chars = testChars();
    if (chars.includes(id)) {
      setTestChars(chars.filter((c) => c !== id));
    } else if (chars.length < 4) {
      setTestChars([...chars, id]);
    }
  }

  /** 当前测试角色组合下的卡池（响应式缓存） */
  const testCardPool = createMemo(() => generateCardPool(data, testChars(), 4));

  /** 自动分析的卡牌关系建议（只计算一次） */
  const suggestedPairs = createMemo(() => analyzeRelationships());

  return (
    <div class="pve-mode">
      <Switch>
        {/* ========== 首页 ========== */}
        <Match when={viewMode() === "home"}>
          <div class="pve-home">
            <h1 class="pve-home-title">七圣召唤 · Roguelike</h1>
            <p class="pve-home-subtitle">选择角色，挑战随机敌人，构建最强卡组！</p>

            <button class="pve-home-start" onClick={startGame}>🎮 开始游戏</button>

            <div class="pve-home-divider" />

            {/* 测试面板 */}
            <div class="pve-debug-panel">
              <h2 class="pve-debug-title">🧪 快速测试</h2>

              {/* 角色选择 */}
              <div class="pve-debug-section">
                <h3>选择角色（点击切换，最多 4 个）</h3>
                <div class="pve-debug-char-grid">
                  <For each={CHARACTER_POOL}>
                    {(char) => (
                      <button
                        class={`pve-debug-char ${testChars().includes(char.id) ? "pve-debug-char-selected" : ""}`}
                        onClick={() => toggleTestChar(char.id)}
                      >
                        <img src={getImageUrl(char.id)} alt={char.name} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
                        <span>{char.name}</span>
                      </button>
                    )}
                  </For>
                </div>
                <p class="pve-debug-hint">已选: {testChars().map((id) => CHARACTER_POOL.find((c) => c.id === id)?.name ?? id).join(", ")}</p>
              </div>

              {/* 初始货币 */}
              <div class="pve-debug-section">
                <h3>初始货币</h3>
                <input type="number" value={testCurrency()} onInput={(e) => setTestCurrency(Number(e.currentTarget.value))} class="pve-debug-input" />
              </div>

              {/* 测试按钮 */}
              <div class="pve-debug-actions">
                <button onClick={testBattle}>⚔️ 测试战斗</button>
                <button onClick={testShop}>🏪 测试商店</button>
                <button onClick={testReward}>🎁 测试奖励</button>
                <button onClick={testFullFlow}>🔄 完整流程（自动胜利）</button>
                <button onClick={() => setShowCardPool(!showCardPool())}>🃏 查看卡池</button>
              </div>

              {/* 卡池查看器 */}
              <Show when={showCardPool()}>
                <div class="pve-cardpool">
                  <h3>当前卡池（{testCardPool().length} 张）</h3>
                  <div class="pve-cardpool-grid">
                    <For each={testCardPool()}>
                      {(card) => (
                        <div class="pve-cardpool-item">
                          <img src={getImageUrl(card.cardId)} alt={card.name} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
                          <span>{card.name}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* 卡牌关联编辑器 */}
              <CardWeightEditor cardPool={testCardPool()} characterPool={CHARACTER_POOL} suggestedPairs={suggestedPairs()} />
            </div>
          </div>
        </Match>

        {/* ========== 游戏界面 ========== */}
        {/* 开局选 2 个角色 */}
        <Match when={run().state === "characterSelect"}>
          <div class="pve-character-select">
            <h2>{!pendingFirst() ? "选择第一个角色" : "选择第二个角色"}</h2>
            <p class="pve-hint">{!pendingFirst() ? "选择 2 个角色开始冒险" : "再选 1 个角色"}</p>
            <CharacterGrid
              characters={run().availableCharacters}
              onSelect={(id) => !pendingFirst() ? selectFirstCharacter(id) : selectSecondCharacter(id)}
            />
            <div class="pve-actions"><button onClick={goHome}>返回首页</button></div>
          </div>
        </Match>

        {/* 追加角色 */}
        <Match when={run().state === "addCharacter"}>
          <div class="pve-character-select">
            <h2>第 {run().floor} 层 - 选择新角色</h2>
            <p class="pve-hint">选择 1 个角色加入队伍（当前 {run().characters.length} 人）</p>
            <CharacterGrid characters={run().availableCharacters} onSelect={addCharacter} />
          </div>
        </Match>

        {/* 遭遇选择 */}
        <Match when={run().state === "encounterSelect"}>
          {(() => {
            const isSkipChar = run().floorSkipCharSelection;
            return (
              <div class="pve-path-select">
                <h2>{isSkipChar ? `第 ${run().floor} 层 · 隐藏Boss` : `第 ${run().floor} 层`}</h2>
                <div class="pve-floor-info">
                  <span>💰 {run().currency}</span>
                  <span>🃏 {run().deck.length} 张</span>
                  <span>👥 {run().characters.length} 人</span>
                </div>
                <Show when={!isSkipChar}>
                  <div class="pve-path-map">
                    <For each={run().path}>
                      {(node, i) => (
                        <div class={`pve-path-node ${i() === run().currentNodeIndex ? "current" : ""} ${node.completed ? "completed" : ""}`}>
                          <div class="pve-node-icon">{NODE_ICON[node.type]}</div>
                          <div class="pve-node-type">{node.type}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={isSkipChar}>
                  <p class="pve-hint">最终挑战——击败Boss即可通关！</p>
                </Show>
                <div class="pve-encounters">
                  <For each={debugMode() !== "off" ? ALL_ENCOUNTERS : runManager().getAvailableEncounters()}>
                    {(encounter) => (
                      <button class="pve-encounter-card" onClick={() => debugMode() !== "off" ? debugSelectEncounter(encounter) : selectEncounter(runManager().getAvailableEncounters().indexOf(encounter))}>
                        <img class="pve-encounter-img" src={getImageUrl(encounter.script.characters[0])} alt={encounter.script.name} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
                        <div class="pve-encounter-type">{encounter.type}</div>
                        <div class="pve-encounter-name">{encounter.script.name}</div>
                        <div class="pve-encounter-reward">💰 {ENCOUNTER_CURRENCY[encounter.type]}</div>
                      </button>
                    )}
                  </For>
                </div>
                <Show when={debugMode() !== "off"}>
                  <div class="pve-actions"><button onClick={goHome}>返回首页</button></div>
                </Show>
              </div>
            );
          })()}
        </Match>

        {/* 战斗 */}
        <Match when={run().state === "battle"}>
          {inBattle() ? (
            <div class="pve-battle"><Chessboard /></div>
          ) : (
            <div class="pve-battle-ready">
              <h2>准备战斗</h2>
              <p>{run().currentEncounter?.script.name}</p>
              <div class="pve-actions">
                <button onClick={startBattle}>开始战斗</button>
                <button onClick={goHome}>返回首页</button>
              </div>
            </div>
          )}
        </Match>

        {/* 奖励 */}
        <Match when={run().state === "reward"}>
          <div class="pve-reward">
            <h2>战斗胜利！选择 1 张卡牌</h2>
            <div class="pve-floor-info"><span>💰 {run().currency}</span></div>
            <Show when={run().rewardItems.length === 0}>
              <p>没有可用的奖励卡牌</p>
            </Show>
            <div class="pve-rewards-row">
              <For each={run().rewardItems}>
                {(reward, index) => (
                  <button
                    class={`pve-reward-card ${selectedReward() === index() ? "selected" : ""}`}
                    onClick={() => setSelectedReward(index())}
                  >
                    <img class="pve-card-img" src={getImageUrl(reward.cardId)} alt={reward.name} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
                    <div class="pve-reward-name">{reward.name}</div>
                  </button>
                )}
              </For>
            </div>
            <div class="pve-actions">
              <button disabled={selectedReward() < 0} onClick={claimReward}>确认选择</button>
              <Show when={debugMode() !== "off"}>
                <button onClick={testRewardRefresh}>🔄 刷新奖励</button>
              </Show>
              <button onClick={goHome}>返回首页</button>
            </div>
          </div>
        </Match>

        {/* 商店 */}
        <Match when={run().state === "shop"}>
          <div class="pve-shop">
            <h2>商店</h2>
            <div class="pve-shop-info">
              <span>💰 {run().currency}</span>
              <span>🔄 刷新: 💰{runManager().getRefreshCost()}</span>
              <span>🗑️ 删牌: 💰{runManager().getDeleteCost()}</span>
              <span>🃏 {run().shopItems.length} 件</span>
            </div>
            <div class="pve-shop-actions">
              <button onClick={refreshShop} disabled={run().currency < runManager().getRefreshCost()}>刷新商店</button>
              <button onClick={() => setShowDeck(!showDeck())}>{showDeck() ? "隐藏卡组" : "查看卡组"}</button>
              <button onClick={finishShop}>离开商店</button>
              <button onClick={goHome}>返回首页</button>
            </div>
            <div class="pve-shop-grid">
              <For each={run().shopItems}>
                {(item, index) => (
                  <button
                    class="pve-shop-item"
                    onClick={() => buyCard(index())}
                    disabled={run().currency < item.cost}
                  >
                    <img class="pve-card-img" src={getImageUrl(item.cardId)} alt={item.name} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
                    <div class="pve-item-name">{item.name}</div>
                    <div class="pve-item-cost">💰 {item.cost}</div>
                  </button>
                )}
              </For>
            </div>
            <Show when={showDeck()}>
              <ShopDeckSection
                deck={run().deck}
                deletingIndex={deletingIndex()}
                onDelete={deleteCard}
                onCancel={cancelDelete}
              />
            </Show>
          </div>
        </Match>

        {/* 通关/失败 */}
        <Match when={run().state === "victory"}>
          <div class="pve-victory">
            <h2>🎉 通关！</h2>
            <p>你成功通过了所有层数！</p>
            <div class="pve-actions">
              <button onClick={restart}>再来一次</button>
              <button onClick={goHome}>返回首页</button>
            </div>
          </div>
        </Match>
        <Match when={run().state === "gameOver"}>
          <div class="pve-game-over">
            <h2>💀 挑战失败</h2>
            <p>你在第 {run().floor} 层被击败了。</p>
            <div class="pve-actions">
              <button onClick={restart}>重新挑战</button>
              <button onClick={goHome}>返回首页</button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}
