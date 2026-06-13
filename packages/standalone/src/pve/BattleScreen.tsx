import { Show, createEffect, createSignal, on, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { RoguelikeRun, RoguelikeRunManager } from "@gi-tcg/roguelike";
import { setAsyncContext } from "@gi-tcg/core";
import { createClient } from "@gi-tcg/web-ui-core";
import "@gi-tcg/web-ui-core/style.css";
import { PbPhaseType } from "@gi-tcg/typings";
import { getEncounterName, getRoguelikeAssetsManager } from "../roguelike-assets";

export type DebugMode = "off" | "manual" | "autoWin";

export interface BattleScreenProps {
  run: Accessor<RoguelikeRun>;
  runManager: Accessor<RoguelikeRunManager>;
  onBattleEnd: (winner: 0 | 1) => void;
  onBattleStateChange?: (inBattle: boolean) => void;
  debugMode: Accessor<DebugMode>;
  onGoHome: () => void;
  onShowToast?: (msg: string) => void;
}

export function BattleScreen(props: BattleScreenProps) {
  const [inBattle, setInBattle] = createSignal(false);
  const [gameEndTrigger, setGameEndTrigger] = createSignal(0);

  const [uiIo, Chessboard, boardData] = createClient(0, {
    assetsManager: getRoguelikeAssetsManager,
  });

  // 响应式检测游戏结束
  createEffect(on(
    () => boardData().state.phase,
    (phase) => { if (phase === PbPhaseType.GAME_END) setGameEndTrigger((n) => n + 1); },
  ));

  const startBattle = async () => {
    let disposed = false;
    onCleanup(() => { disposed = true; });
    const encounter = props.run().currentEncounter;
    if (!encounter) return;
    setInBattle(true);
    props.onBattleStateChange?.(true);
    try {
      const { game, playerWho } = props.runManager().createBattleGame(encounter);
      game.players[playerWho].io = uiIo;
      await setAsyncContext(true);
      const winner = await game.start();
      // 等待 UI 渲染到 GAME_END 阶段
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
        onCleanup(() => { clearInterval(check); clearTimeout(timeout); });
      });
      if (!disposed) props.onBattleEnd(winner === 0 ? 0 : 1);
    } catch (e) {
      console.error("[startBattle] Battle error:", e);
      props.onShowToast?.(`战斗出错: ${e instanceof Error ? e.message : String(e)}`);
      if (!disposed) props.onBattleEnd(1);
    } finally {
      setAsyncContext(false);
      if (!disposed) {
        setInBattle(false);
        props.onBattleStateChange?.(false);
      }
    }
  };

  return (
    <>
      {inBattle() ? (
        <div class="pve-battle"><Chessboard /></div>
      ) : (
        <div class="pve-battle-ready">
          <h2>准备战斗</h2>
          <p>{(() => { const e = props.run().currentEncounter; return e ? getEncounterName(e) : ""; })()}</p>
          <div class="pve-actions">
            <button onClick={startBattle}>开始战斗</button>
            <Show when={props.debugMode() !== "off"}>
              <button onClick={props.onGoHome}>返回首页</button>
            </Show>
          </div>
        </div>
      )}
    </>
  );
}
