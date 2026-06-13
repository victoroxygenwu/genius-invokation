import { Show } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { RoguelikeRunManager, Encounter } from "@gi-tcg/roguelike";
import { DebugPanel } from "../DebugPanel";
import type { CharacterPoolEntry } from "@gi-tcg/roguelike";

export type DebugMode = "off" | "manual" | "autoWin";

export interface HomeScreenProps {
  characterPool: CharacterPoolEntry[];
  runManager: Accessor<RoguelikeRunManager>;
  hasSave: Accessor<boolean>;
  saveLoading?: Accessor<boolean>;
  onContinue: () => void;
  onStartGame: () => void;
  onCreateRunManager: (loadSave?: boolean, enableStorage?: boolean) => void;
  onSetDebugMode: Setter<DebugMode>;
  onSetViewMode: Setter<"home" | "game">;
  onSetTestBattleMode: Setter<boolean>;
  onDebugSelectEncounter: (encounter: Encounter) => void;
  onShowToast?: (msg: string) => void;
}

export function HomeScreen(props: HomeScreenProps) {
  return (
    <div class="pve-home">
      <h1 class="pve-home-title">七圣召唤 · Roguelike</h1>
      <p class="pve-home-subtitle">选择角色，挑战随机敌人，构建最强卡组！</p>

      <Show when={props.saveLoading?.()}>
        <p class="pve-home-loading">检查存档中...</p>
      </Show>
      <Show when={!props.saveLoading?.() && props.hasSave()}>
        <button class="pve-home-continue" onClick={props.onContinue}>📖 继续游戏</button>
      </Show>
      <Show when={!props.saveLoading?.()}>
        <button class="pve-home-start" onClick={props.onStartGame}>🎮 开始游戏</button>
      </Show>

      <div class="pve-home-divider" />

      <DebugPanel
        characterPool={props.characterPool}
        runManager={props.runManager}
        onCreateRunManager={props.onCreateRunManager}
        onSetDebugMode={props.onSetDebugMode}
        onSetViewMode={props.onSetViewMode}
        onSetTestBattleMode={props.onSetTestBattleMode}
        onStartGame={props.onStartGame}
        onDebugSelectEncounter={props.onDebugSelectEncounter}
        onShowToast={props.onShowToast}
      />
    </div>
  );
}
