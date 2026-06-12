import { For, Show, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import type { RoguelikeRun } from "@gi-tcg/roguelike";
import { getRefreshCost, getDeleteCost, getCardName } from "@gi-tcg/roguelike";
import { SafeImage } from "../SafeImage";
import type { DebugMode } from "./HomeScreen";

export interface ShopScreenProps {
  run: Accessor<RoguelikeRun>;
  onBuyCard: (index: number) => void;
  onRefreshShop: () => void;
  onDeleteCard: (i: number) => void;
  onFinishShop: () => void;
  debugMode: Accessor<DebugMode>;
  onGoHome: () => void;
}

export function ShopScreen(props: ShopScreenProps) {
  const [showDeck, setShowDeck] = createSignal(false);
  const [deletingIndex, setDeletingIndex] = createSignal(-1);

  const deleteCard = (i: number) => {
    const r = props.run();
    const cost = getDeleteCost(r.deleteCount);
    if (r.currency < cost) {
      alert("费用不足！");
      return;
    }
    if (deletingIndex() === i) {
      props.onDeleteCard(i);
      setDeletingIndex(-1);
    } else {
      setDeletingIndex(i);
    }
  };

  const cancelDelete = () => setDeletingIndex(-1);

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
        <button onClick={() => setShowDeck(!showDeck())}>{showDeck() ? "隐藏卡组" : "查看卡组"}</button>
        <button onClick={() => { setDeletingIndex(-1); props.onFinishShop(); }}>离开商店</button>
        <Show when={props.debugMode() !== "off"}>
          <button onClick={props.onGoHome}>返回首页</button>
        </Show>
      </div>
      <div class="pve-shop-grid">
        <For each={props.run().shopItems}>
          {(item, index) => (
            <button
              class="pve-shop-item"
              onClick={() => props.onBuyCard(index())}
              disabled={props.run().currency < item.cost}
            >
              <SafeImage class="pve-card-img" entityId={item.cardId} alt={item.name} loading="lazy" />
              <div class="pve-item-name">{item.name}</div>
              <div class="pve-item-cost">💰 {item.cost}</div>
            </button>
          )}
        </For>
      </div>
      <Show when={showDeck()}>
        <div class="pve-deck-section">
          <h3>当前卡组 ({props.run().deck.length} 张)</h3>
          <div class="pve-deck-items">
            <For each={props.run().deck}>
              {(cardId, index) => (
                <button
                  class={`pve-deck-item ${deletingIndex() === index() ? "pve-deck-item-deleting" : ""}`}
                  onClick={() => deleteCard(index())}
                >
                  <SafeImage class="pve-deck-img" entityId={cardId} alt={getCardName(cardId)} loading="lazy" />
                  <div class="pve-deck-name">{getCardName(cardId)}</div>
                  <Show when={deletingIndex() === index()}>
                    <div class="pve-deck-confirm">再点确认删除</div>
                  </Show>
                </button>
              )}
            </For>
          </div>
          <Show when={deletingIndex() >= 0}>
            <button class="pve-deck-cancel" onClick={cancelDelete}>取消删除</button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
