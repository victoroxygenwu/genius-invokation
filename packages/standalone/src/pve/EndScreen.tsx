import type { Accessor } from "solid-js";
import type { RoguelikeRun } from "@gi-tcg/roguelike";

export type EndScreenState = "victory" | "gameOver";

export interface EndScreenProps {
  state: EndScreenState;
  run: Accessor<RoguelikeRun>;
  onRestart: () => void;
  onGoHome: () => void;
}

export function EndScreen(props: EndScreenProps) {
  return props.state === "victory" ? (
    <div class="pve-victory">
      <h2>🎉 通关！</h2>
      <p>你成功通过了所有层数！</p>
      <div class="pve-actions">
        <button onClick={props.onRestart}>再来一次</button>
        <button onClick={props.onGoHome}>返回首页</button>
      </div>
    </div>
  ) : (
    <div class="pve-game-over">
      <h2>💀 挑战失败</h2>
      <p>你在第 {props.run().floor} 层被击败了。</p>
      <div class="pve-actions">
        <button onClick={props.onRestart}>重新挑战</button>
        <button onClick={props.onGoHome}>返回首页</button>
      </div>
    </div>
  );
}
