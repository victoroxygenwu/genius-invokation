import { Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { RoguelikeRun, CharacterPoolEntry } from "@gi-tcg/roguelike";
import { EntityGrid } from "../EntityGrid";
import type { DebugMode } from "./HomeScreen";

export interface CharacterSelectScreenProps {
  run: Accessor<RoguelikeRun>;
  /** true = 已选第一个，等待选第二个 */
  pendingFirst: Accessor<boolean>;
  onSelectFirst: (id: number) => void;
  onSelectSecond: (id: number) => void;
  /** 仅 addCharacter 模式使用 */
  addCharacterMode?: boolean;
  onAddCharacter?: (id: number) => void;
  debugMode: Accessor<DebugMode>;
  onGoHome: () => void;
}

export function CharacterSelectScreen(props: CharacterSelectScreenProps) {
  return (
    <div class="pve-character-select">
      {props.addCharacterMode ? (
        <>
          <h2>第 {props.run().floor} 层 - 选择新角色</h2>
          <p class="pve-hint">选择 1 个角色加入队伍（当前 {props.run().characters.length} 人）</p>
          <EntityGrid
            items={props.run().availableCharacters}
            mode="single"
            onChange={props.onAddCharacter!}
            class="pve-character-grid"
            itemClass="pve-character-card"
            extra={(char) => <span class="pve-character-element">{(char as CharacterPoolEntry).element}</span>}
          />
        </>
      ) : (
        <>
          <h2>{!props.pendingFirst() ? "选择第一个角色" : "选择第二个角色"}</h2>
          <p class="pve-hint">{!props.pendingFirst() ? "选择 2 个角色开始冒险" : "再选 1 个角色"}</p>
          <EntityGrid
            items={props.run().availableCharacters}
            mode="single"
            onChange={(id) => !props.pendingFirst() ? props.onSelectFirst(id) : props.onSelectSecond(id)}
            class="pve-character-grid"
            itemClass="pve-character-card"
            extra={(char) => <span class="pve-character-element">{(char as CharacterPoolEntry).element}</span>}
          />
          <Show when={props.debugMode() !== "off"}>
            <div class="pve-actions"><button onClick={props.onGoHome}>返回首页</button></div>
          </Show>
        </>
      )}
    </div>
  );
}
