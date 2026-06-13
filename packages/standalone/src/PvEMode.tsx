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

import getRoguelikeData from "@gi-tcg/roguelike-data";
import { CURRENT_VERSION } from "@gi-tcg/core";
import { Match, Show, Switch, createSignal, onCleanup, onMount } from "solid-js";
import {
  RoguelikeRunManager,
  generateCharacterPool,
  validateEnemyIds,
  validateStatusIds,
  validateCardIds,
  DEFAULT_EVENTS,
  type RoguelikeRun,
  type Encounter,
} from "@gi-tcg/roguelike";
import { configStore } from "./configStore";
import { SimpleStorageAdapter } from "./file-storage";
import { createConfirm } from "./ConfirmModal";
import { HomeScreen, type DebugMode } from "./pve/HomeScreen";
import { CharacterSelectScreen } from "./pve/CharacterSelectScreen";
import { EncounterSelectScreen } from "./pve/EncounterSelectScreen";
import { BattleScreen } from "./pve/BattleScreen";
import { RewardScreen } from "./pve/RewardScreen";
import { ShopScreen } from "./pve/ShopScreen";
import { EventScreen } from "./pve/EventScreen";
import { EndScreen } from "./pve/EndScreen";

const data = getRoguelikeData(CURRENT_VERSION);
const CHARACTER_POOL = generateCharacterPool(data).sort((a, b) => a.id - b.id);

// 启动时验证硬编码 ID 是否与 GameData 一致
const _enemyWarnings = validateEnemyIds(data.characters);
const _statusWarnings = validateStatusIds(data.entities);
const _cardWarnings = validateCardIds(data.entities);
if (_enemyWarnings.length > 0) console.warn("[Roguelike] Enemy ID validation:", _enemyWarnings);
if (_statusWarnings.length > 0) console.warn("[Roguelike] Status ID validation:", _statusWarnings);
if (_cardWarnings.length > 0) console.warn("[Roguelike] Card ID validation:", _cardWarnings);

export interface PvEModeProps {
  onBack?: () => void;
}

export function PvEMode(props: PvEModeProps) {
  const [runManager, setRunManager] = createSignal<RoguelikeRunManager>(null!);
  const [run, setRun] = createSignal<RoguelikeRun>(null!);
  const [viewMode, setViewMode] = createSignal<"home" | "game">("home");
  const [debugMode, setDebugMode] = createSignal<DebugMode>("off");
  const [pendingFirst, setPendingFirst] = createSignal(false);
  const [battleActive, setBattleActive] = createSignal(false);
  const [testBattleMode, setTestBattleMode] = createSignal(false);

  // ---- Toast 通知（单信号：空字符串=隐藏） ----
  const [toast, setToast] = createSignal("");
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const showToast = (msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    toastTimer = setTimeout(() => { toastTimer = null; setToast(""); }, 2000);
  };
  onCleanup(() => { if (toastTimer) clearTimeout(toastTimer); });

  const GAME_SAVE_KEY = "gi-tcg-game-save";
  const saveStorage = new SimpleStorageAdapter("saves");

  function createRunManager(loadSave = false, enableStorage = loadSave) {
    const levelCfg = configStore.levelConfig();
    const storedEvents = configStore.events();
    const events = [storedEvents, levelCfg.events ?? [], DEFAULT_EVENTS].find(a => a.length > 0)!;
    const config = { ...levelCfg, events };
    const mgr = new RoguelikeRunManager(data, config, configStore.enemyPool(), configStore.cardCosts(), {
      storage: enableStorage ? saveStorage : undefined,
      saveKey: enableStorage ? GAME_SAVE_KEY : undefined,
    });
    mgr.setOnUpdate((newRun) => setRun(newRun));
    setRunManager(mgr);
    if (!loadSave) setRun(mgr.getRun());
    return mgr;
  }

  // 初始注册 onUpdate
  createRunManager();

  // ---- 确认弹窗 ----
  const { confirm: customConfirm, Modal: ConfirmModalComponent } = createConfirm();

  // ---- 导航函数 ----

  const resetNav = (view: "home" | "game") => { setViewMode(view); setDebugMode("off"); };

  const goHome = () => { createRunManager(); resetNav("home"); setTestBattleMode(false); };
  const startGame = async () => {
    if (hasSaveValue()) {
      if (!await customConfirm("已有存档，开始新游戏将覆盖当前存档。确定继续？")) return;
    }
    runManager().clearSave();
    setHasSaveValue(false);
    createRunManager(false, true);
    resetNav("game");
  };
  const continueGame = async () => {
    const mgr = createRunManager(true);
    const loaded = await mgr.ready();
    if (!loaded) { createRunManager(); resetNav("home"); return; }
    resetNav("game");
  };
  const pauseGame = () => { resetNav("home"); checkHasSave(); };
  const quitGame = async () => {
    if (!await customConfirm("确定放弃本局游戏？当前进度将不会保存。")) return;
    runManager().clearSave();
    setHasSaveValue(false);
    createRunManager();
    resetNav("home");
  };
  const restart = () => { runManager().restart(); setPendingFirst(false); };

  const [hasSaveValue, setHasSaveValue] = createSignal(false);
  const [saveLoading, setSaveLoading] = createSignal(true);
  // 异步检查存档（IndexedDB 需要等待初始化）
  const checkHasSave = async () => {
    setSaveLoading(true);
    setHasSaveValue(await RoguelikeRunManager.hasSave(saveStorage, GAME_SAVE_KEY));
    setSaveLoading(false);
  };
  // 组件挂载时检查一次，之后在 pauseGame/quitGame 中刷新
  onMount(() => checkHasSave());
  // 页面关闭前刷写待存档数据（debounce 兜底，使用同步写入确保 IDB 提交）
  onMount(() => {
    const flush = () => { try { runManager().flushSync(); } catch {} };
    window.addEventListener("beforeunload", flush);
    onCleanup(() => window.removeEventListener("beforeunload", flush));
  });

  const canPause = () => RoguelikeRunManager.canSave(run());

  // ---- 角色选择 ----
  const selectFirstCharacter = (id: number) => { runManager().selectFirstCharacter(id); setPendingFirst(true); };
  const selectSecondCharacter = (id: number) => { runManager().selectSecondCharacter(id); setPendingFirst(false); };
  const addCharacter = (id: number) => runManager().addCharacter(id);
  const selectEncounter = (index: number) => runManager().selectEncounter(index);

  // ---- 奖励 ----
  const claimReward = (idx: number) => runManager().claimRewardAndFinish(idx, testBattleMode());

  // ---- 商店 ----
  const buyCard = (index: number) => { if (!runManager().buyCard(index)) showToast("费用不足！"); };
  const refreshShop = () => { if (!runManager().refreshShop()) showToast("费用不足！"); };
  const deleteCard = (i: number) => { runManager().deleteCard(i); };
  const finishShop = () => { runManager().finishShop(); };

  // ---- 战斗 ----
  const onBattleEnd = (winner: 0 | 1) => {
    if (testBattleMode() && winner === 0) {
      // 战斗测试模式：胜利后直接回首页
      runManager().setRun({ state: "encounterSelect" });
      setViewMode("home");
      setTestBattleMode(false);
    } else {
      runManager().onBattleEnd(winner);
    }
  };

  // ---- 调试 ----
  function debugSelectEncounter(encounter: Encounter) {
    runManager().setRun({ currentEncounter: encounter, state: "battle" });
    if (debugMode() === "autoWin") runManager().onBattleEnd(0);
  }
  const testRewardRefresh = () => runManager().onBattleEnd(0);

  return (
    <div class="pve-mode">
      <Show when={viewMode() === "game" && !battleActive() && canPause() && debugMode() === "off"}>
        <div class="pve-save-bar">
          <button class="pve-btn-pause" onClick={pauseGame}>暂离</button>
          <button class="pve-btn-quit" onClick={quitGame}>退出</button>
        </div>
      </Show>
      <Switch>
        <Match when={viewMode() === "home"}>
          <HomeScreen
            characterPool={CHARACTER_POOL}
            runManager={runManager}
            hasSave={hasSaveValue}
            saveLoading={saveLoading}
            onContinue={continueGame}
            onStartGame={startGame}
            onCreateRunManager={createRunManager}
            onSetDebugMode={setDebugMode}
            onSetViewMode={setViewMode}
            onSetTestBattleMode={setTestBattleMode}
            onDebugSelectEncounter={debugSelectEncounter}
            onShowToast={showToast}
          />
        </Match>

        <Match when={run().state === "characterSelect"}>
          <CharacterSelectScreen
            run={run}
            pendingFirst={pendingFirst}
            onSelectFirst={selectFirstCharacter}
            onSelectSecond={selectSecondCharacter}
            debugMode={debugMode}
            onGoHome={goHome}
          />
        </Match>

        <Match when={run().state === "addCharacter"}>
          <CharacterSelectScreen
            run={run}
            pendingFirst={pendingFirst}
            onSelectFirst={selectFirstCharacter}
            onSelectSecond={selectSecondCharacter}
            addCharacterMode
            onAddCharacter={addCharacter}
            debugMode={debugMode}
            onGoHome={goHome}
          />
        </Match>

        <Match when={run().state === "encounterSelect"}>
          <EncounterSelectScreen
            run={run}
            runManager={runManager}
            onSelectEncounter={selectEncounter}
            debugMode={debugMode}
            onDebugSelectEncounter={debugSelectEncounter}
            onGoHome={goHome}
            testMode={testBattleMode()}
          />
        </Match>

        <Match when={run().state === "battle"}>
          <BattleScreen
            run={run}
            runManager={runManager}
            onBattleEnd={onBattleEnd}
            onBattleStateChange={setBattleActive}
            debugMode={debugMode}
            onGoHome={goHome}
            onShowToast={showToast}
          />
        </Match>

        <Match when={run().state === "reward"}>
          <RewardScreen
            run={run}
            onClaimReward={claimReward}
            debugMode={debugMode}
            onTestRewardRefresh={testRewardRefresh}
            onGoHome={goHome}
          />
        </Match>

        <Match when={run().state === "shop"}>
          <ShopScreen
            run={run}
            onBuyCard={buyCard}
            onRefreshShop={refreshShop}
            onDeleteCard={deleteCard}
            onFinishShop={finishShop}
            debugMode={debugMode}
            onGoHome={goHome}
            onShowToast={showToast}
          />
        </Match>

        <Match when={run().state === "event"}>
          <EventScreen
            run={run}
            runManager={runManager}
            debugMode={debugMode}
            onGoHome={goHome}
          />
        </Match>

        <Match when={run().state === "victory"}>
          <EndScreen state="victory" run={run} onRestart={restart} onGoHome={goHome} />
        </Match>

        <Match when={run().state === "gameOver"}>
          <EndScreen state="gameOver" run={run} onRestart={restart} onGoHome={goHome} />
        </Match>
      </Switch>
      <Show when={toast()}>
        <div class="pve-toast">{toast()}</div>
      </Show>
      <ConfirmModalComponent />
    </div>
  );
}
