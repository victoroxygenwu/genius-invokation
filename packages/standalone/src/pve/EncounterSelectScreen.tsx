import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";
import type { RoguelikeRun, RoguelikeRunManager, Encounter } from "@gi-tcg/roguelike";
import {
  getEncounterCurrency,
  getEncounterCharacterIds,
} from "@gi-tcg/roguelike";
import { getCardName, getEncounterName } from "../roguelike-assets";
import { SafeImage } from "../SafeImage";
import { NODE_INFO } from "../nodeInfo";

export interface EncounterSelectScreenProps {
  run: Accessor<RoguelikeRun>;
  runManager: Accessor<RoguelikeRunManager>;
  onSelectEncounter: (index: number) => void;
  debugMode: Accessor<string>;
  onDebugSelectEncounter: (encounter: Encounter) => void;
  onGoHome: () => void;
  /** 测试模式：隐藏路径图，只显示遭遇选择 */
  testMode?: boolean;
}

export function EncounterSelectScreen(props: EncounterSelectScreenProps) {
  const isSkipChar = () => props.run().floorSkipCharSelection;

  return (
    <div class="pve-path-select">
      <h2>{isSkipChar() ? `第 ${props.run().floor} 层 · 隐藏Boss` : `第 ${props.run().floor} 层`}</h2>
      <div class="pve-floor-info">
        <span>💰 {props.run().currency}</span>
        <span>🃏 {props.run().deck.length} 张</span>
        <span>👥 {props.run().characters.length} 人</span>
      </div>
      <Show when={!isSkipChar() && !props.testMode}>
        <div class="pve-path-map">
          <For each={props.run().path}>
            {(node, i) => {
              const nodeClass = () => `pve-path-node ${i() === props.run().currentNodeIndex ? "current" : ""} ${node.completed ? "completed" : ""}`;
              return (
                <div class={nodeClass()}>
                  <div class="pve-node-icon">{NODE_INFO[node.type].icon}</div>
                  <div class="pve-node-type">{node.type}</div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
      <Show when={isSkipChar()}>
        <p class="pve-hint">最终挑战——击败Boss即可通关！</p>
      </Show>
      <div class="pve-encounters">
        <For each={props.runManager().getAvailableEncounters()}>
          {(encounter, idx) => (
            <button class="pve-encounter-card" onClick={() => props.debugMode() !== "off" ? props.onDebugSelectEncounter(encounter) : props.onSelectEncounter(idx())}>
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
      <Show when={props.debugMode() !== "off"}>
        <div class="pve-actions"><button onClick={props.onGoHome}>返回首页</button></div>
      </Show>
    </div>
  );
}
