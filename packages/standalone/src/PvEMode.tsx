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
import { For, Match, Show, Switch, createEffect, createSignal, on } from "solid-js";
import {
  RoguelikeRunManager,
  getEncounterCurrency,
  getCardName,
  generateCharacterPool,
  getRefreshCost,
  getDeleteCost,
  getEncounterName,
  getEncounterCharacterIds,
  validateEnemyIds,
  validateStatusIds,
  validateCardIds,
  getEffectDescription,
  type RoguelikeRun,
  type Encounter,
  type CharacterPoolEntry,
  type EventDefinition,
} from "@gi-tcg/roguelike";
import { DebugPanel } from "./DebugPanel";
import { getLevelConfig, getEnemyPool, getCardCosts, getEvents } from "./configStore";
import { SafeImage } from "./SafeImage";
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
            <SafeImage class="pve-character-img" entityId={char.id} alt={char.name} loading="lazy" />
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
              <SafeImage class="pve-deck-img" entityId={cardId} alt={getCardName(cardId)} loading="lazy" />
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

import { NODE_INFO } from "./nodeInfo";

const data = getData(CURRENT_VERSION);
const CHARACTER_POOL = generateCharacterPool(data).sort((a, b) => a.id - b.id);

// 启动时验证硬编码 ID 是否与 GameData 一致
const _enemyWarnings = validateEnemyIds(data.characters);
const _statusWarnings = validateStatusIds(data.entities);
const _cardWarnings = validateCardIds(data.entities);
if (_enemyWarnings.length > 0) console.warn("[Roguelike] Enemy ID validation:", _enemyWarnings);
if (_statusWarnings.length > 0) console.warn("[Roguelike] Status ID validation:", _statusWarnings);
if (_cardWarnings.length > 0) console.warn("[Roguelike] Card ID validation:", _cardWarnings);

type DebugMode = "off" | "manual" | "autoWin";

export interface PvEModeProps {
  onBack?: () => void;
}

export function PvEMode(props: PvEModeProps) {
  const [runManager, setRunManager] = createSignal<RoguelikeRunManager>(null!);
  const [run, setRun] = createSignal<RoguelikeRun>(null!);
  const [selectedReward, setSelectedReward] = createSignal<number>(-1);
  const [inBattle, setInBattle] = createSignal(false);
  const [showDeck, setShowDeck] = createSignal(false);
  const [deletingIndex, setDeletingIndex] = createSignal<number>(-1);

  // 首页 / 游戏视图切换
  const [viewMode, setViewMode] = createSignal<"home" | "game">("home");

  // 调试模式（由 DebugPanel 设置，影响遭遇选择行为）
  const [debugMode, setDebugMode] = createSignal<DebugMode>("off");

  const [uiIo, Chessboard, boardData] = createClient(0);

  // 响应式检测游戏结束（替代轮询）
  const [gameEndTrigger, setGameEndTrigger] = createSignal(0);
  createEffect(on(
    () => boardData().state.phase,
    (phase) => { if (phase === PbPhaseType.GAME_END) setGameEndTrigger((n) => n + 1); },
  ));

  /** 创建新 runManager 并注册 onUpdate 回调 */
  function createRunManager() {
    const levelCfg = getLevelConfig();
    const events = getEvents();
    // 合并事件到关卡配置（configStore 中的 events 优先于 levelConfig 中的）
    const config = { ...levelCfg, events: events.length > 0 ? events : levelCfg.events };
    const mgr = new RoguelikeRunManager(data, config, getEnemyPool(), getCardCosts());
    mgr.setOnUpdate((newRun) => setRun(newRun));
    setRunManager(mgr);
    setRun(mgr.getRun());
  }

  // 初始注册 onUpdate
  createRunManager();

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
  const goHome = () => { createRunManager(); setViewMode("home"); setDebugMode("off"); };
  const startGame = () => { createRunManager(); setViewMode("game"); setDebugMode("off"); };

  // ============================================================
  // 调试模式辅助
  // ============================================================

  /** 遭遇选择时的调试回调 */
  function debugSelectEncounter(encounter: Encounter) {
    runManager().debugSetRun({ currentEncounter: encounter, state: "battle" });
    if (debugMode() === "autoWin") {
      runManager().onBattleEnd(0);
    }
  }

  /** 刷新奖励（调试用） */
  const testRewardRefresh = () => runManager().onBattleEnd(0);

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
            <DebugPanel
              characterPool={CHARACTER_POOL}
              runManager={runManager}
              onCreateRunManager={createRunManager}
              onSetDebugMode={setDebugMode}
              onSetViewMode={setViewMode}
              onStartGame={startGame}
              onDebugSelectEncounter={debugSelectEncounter}
            />
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
                          <div class="pve-node-icon">{NODE_INFO[node.type].icon}</div>
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
                  <For each={runManager().getAvailableEncounters()}>
                    {(encounter, idx) => (
                      <button class="pve-encounter-card" onClick={() => debugMode() !== "off" ? debugSelectEncounter(encounter) : selectEncounter(idx())}>
                        <div class="pve-encounter-images">
                          <For each={getEncounterCharacterIds(encounter)}>
                            {(charId) => (
                              <Show when={charId > 0} fallback={<div class="pve-encounter-img" style={{ width: "60px", height: "80px", background: "#334155", "border-radius": "4px" }} />}>
                                <SafeImage class="pve-encounter-img" entityId={charId} alt={getCardName(charId)} loading="lazy" />
                              </Show>
                            )}
                          </For>
                        </div>
                        <div class="pve-encounter-type">{encounter.type}</div>
                        <div class="pve-encounter-name">{getEncounterName(encounter)}</div>
                        <div class="pve-encounter-reward">💰 {getEncounterCurrency(encounter)}</div>
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
              <p>{(() => { const e = run().currentEncounter; return e ? getEncounterName(e) : ""; })()}</p>
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
                    <SafeImage class="pve-card-img" entityId={reward.cardId} alt={reward.name} loading="lazy" />
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
              <span>🔄 刷新: 💰{getRefreshCost(run().refreshCount)}</span>
              <span>🗑️ 删牌: 💰{getDeleteCost(run().deleteCount)}</span>
              <span>🃏 剩余: {run().shopItems.length} 件</span>
            </div>
            <div class="pve-shop-actions">
              <button onClick={refreshShop} disabled={run().currency < getRefreshCost(run().refreshCount)}>刷新商店</button>
              <button onClick={() => setShowDeck(!showDeck())}>{showDeck() ? "隐藏卡组" : "查看卡组"}</button>
              <Show when={debugMode() !== "manual"}>
                <button onClick={finishShop}>离开商店</button>
              </Show>
              <Show when={debugMode() !== "off"}>
                <button onClick={goHome}>返回首页</button>
              </Show>
            </div>
            <div class="pve-shop-grid">
              <For each={run().shopItems}>
                {(item, index) => (
                  <button
                    class="pve-shop-item"
                    onClick={() => buyCard(index())}
                    disabled={run().currency < item.cost}
                  >
                    <SafeImage class="pve-card-img" entityId={item.cardId} alt={item.name} loading="lazy" />
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

        {/* 事件 */}
        <Match when={run().state === "event"}>
          {(() => {
            const event = run().currentEvent;
            if (!event) return null;
            const renderedText = runManager().renderEventText(event.storyTemplate);
            const effectDescs = runManager().getEventEffectDescriptions(event);
            return (
              <div class="pve-event">
                <h2>{event.eventTag === "positive" ? "✨" : "💀"} {event.name}</h2>
                <Show when={event.imageUrl}>
                  <img class="pve-event-image" src={event.imageUrl} alt={event.name} />
                </Show>
                <Show when={!event.imageUrl}>
                  <div class="pve-event-image-placeholder">
                    {event.eventTag === "positive" ? "✨" : "💀"}
                  </div>
                </Show>
                <p class="pve-event-story">{renderedText}</p>
                <Show when={effectDescs.length > 0}>
                  <div class="pve-event-effects">
                    <h3>效果</h3>
                    <For each={effectDescs}>{(desc) => (
                      <div class="pve-event-effect-item">{desc}</div>
                    )}</For>
                  </div>
                </Show>
                <div class="pve-actions">
                  <button onClick={() => runManager().confirmEvent()}>确认</button>
                  <Show when={debugMode() !== "off"}>
                    <button onClick={goHome}>返回首页</button>
                  </Show>
                </div>
              </div>
            );
          })()}
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
