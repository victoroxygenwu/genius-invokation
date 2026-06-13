import { For, Show, createSignal, createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import type { RoguelikeRun } from "@gi-tcg/roguelike";
import { getCardDescription } from "@gi-tcg/roguelike";
import { SafeImage } from "../SafeImage";
import type { DebugMode } from "./HomeScreen";
import { sortByCardId } from "./utils";

export interface RewardScreenProps {
  run: Accessor<RoguelikeRun>;
  onClaimReward: (index: number) => void;
  debugMode: Accessor<DebugMode>;
  onTestRewardRefresh: () => void;
  onGoHome: () => void;
}

export function RewardScreen(props: RewardScreenProps) {
  const [selectedReward, setSelectedReward] = createSignal(-1);
  const isTest = () => props.debugMode() !== "off";

  // 按卡牌ID排序的奖励列表（带原始索引）
  const sortedRewards = createMemo(() => sortByCardId(props.run().rewardItems));

  const selectCard = (originalIndex: number) => {
    if (isTest()) {
      // 测试模式：点击直接领取
      props.onClaimReward(originalIndex);
    } else {
      setSelectedReward(originalIndex);
    }
  };

  return (
    <div class="pve-reward">
      <h2>战斗胜利！选择 1 张卡牌</h2>
      <Show when={props.debugMode() === "off"}>
        <div class="pve-floor-info"><span>💰 {props.run().currency}</span></div>
      </Show>
      <Show when={props.run().rewardItems.length === 0}>
        <p>没有可用的奖励卡牌</p>
      </Show>
      <div class="pve-rewards-row">
        <For each={sortedRewards()}>
          {(reward) => {
            const desc = getCardDescription(reward.cardId);
            return (
            <button
              class={`pve-reward-card ${!isTest() && selectedReward() === reward.originalIndex ? "selected" : ""}`}
              onClick={() => selectCard(reward.originalIndex)}
            >
              <SafeImage class="pve-card-img" entityId={reward.cardId} alt={reward.name} loading="lazy" />
              <div class="pve-reward-name">{reward.name}</div>
              {desc && <div class="pve-card-tooltip">{desc}</div>}
            </button>
            );
          }}
        </For>
      </div>
      <div class="pve-actions">
        <Show when={!isTest()}>
          <button disabled={selectedReward() < 0} onClick={() => props.onClaimReward(selectedReward())}>确认选择</button>
        </Show>
        <Show when={isTest()}>
          <button onClick={props.onTestRewardRefresh}>🔄 刷新奖励</button>
          <button onClick={props.onGoHome}>返回首页</button>
        </Show>
      </div>
    </div>
  );
}
