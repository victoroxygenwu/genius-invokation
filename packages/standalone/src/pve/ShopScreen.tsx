import { For, Show, createSignal, createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import type { RoguelikeRun } from "@gi-tcg/roguelike";
import { getRefreshCost, getDeleteCost, getCardDescription } from "@gi-tcg/roguelike";
import { SafeImage } from "../SafeImage";
import type { DebugMode } from "./HomeScreen";
import { DeckDialog } from "./DeckDialog";
import { sortByCardId } from "./utils";

export interface ShopScreenProps {
  run: Accessor<RoguelikeRun>;
  onBuyCard: (index: number) => void;
  onRefreshShop: () => void;
  onDeleteCard: (i: number) => void;
  onFinishShop: () => void;
  debugMode: Accessor<DebugMode>;
  onGoHome: () => void;
  onShowToast?: (msg: string) => void;
}

export function ShopScreen(props: ShopScreenProps) {
  const [showDeleteDialog, setShowDeleteDialog] = createSignal(false);

  // 按卡牌ID排序的商品列表（带原始索引）
  const sortedShopItems = createMemo(() => sortByCardId(props.run().shopItems));

  const handleDeleteCard = (index: number) => {
    const r = props.run();
    const cost = getDeleteCost(r.deleteCount);
    if (r.currency < cost) {
      props.onShowToast?.("费用不足！");
      return;
    }
    props.onDeleteCard(index);
  };

  return (
    <div class="pve-shop">
      <h2>商店</h2>
      <div class="pve-shop-info">
        <span>💰 {props.run().currency}</span>
        <span>🔄 刷新: 💰{getRefreshCost(props.run().refreshCount)}</span>
        <span>🗑️ 删牌: 💰{getDeleteCost(props.run().deleteCount)}</span>
        <span>🃏 剩余: {props.run().shopItems.length} 件</span>
      </div>
      <div class="pve-shop-actions">
        <button onClick={props.onRefreshShop} disabled={props.run().currency < getRefreshCost(props.run().refreshCount)}>刷新商店</button>
        <button onClick={() => setShowDeleteDialog(true)}>删除卡牌</button>
        <button onClick={props.onFinishShop}>离开商店</button>
        <Show when={props.debugMode() !== "off"}>
          <button onClick={props.onGoHome}>返回首页</button>
        </Show>
      </div>
      <div class="pve-shop-grid">
        <For each={sortedShopItems()}>
          {(item) => {
            const desc = getCardDescription(item.cardId);
            return (
            <button
              class="pve-shop-item"
              onClick={() => props.onBuyCard(item.originalIndex)}
              disabled={props.run().currency < item.cost}
            >
              <SafeImage class="pve-card-img" entityId={item.cardId} alt={item.name} loading="lazy" />
              <div class="pve-item-name">{item.name}</div>
              <div class="pve-item-cost">💰 {item.cost}</div>
              {desc && <div class="pve-card-tooltip">{desc}</div>}
            </button>
            );
          }}
        </For>
      </div>
      <DeckDialog
        run={props.run}
        show={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onDeleteCard={handleDeleteCard}
        showDelete={true}
      />
    </div>
  );
}
