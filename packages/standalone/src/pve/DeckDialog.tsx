import { For, Show, createSignal, createMemo } from "solid-js";
import type { Accessor } from "solid-js";
import type { RoguelikeRun } from "@gi-tcg/roguelike";
import { getCardDescription } from "@gi-tcg/roguelike";
import { SafeImage } from "../SafeImage";
import { getCardName } from "../roguelike-assets";
import { sortByCardId } from "./utils";

export interface DeckDialogProps {
  run: Accessor<RoguelikeRun>;
  show: Accessor<boolean>;
  onClose: () => void;
  onDeleteCard?: (index: number) => void;
  showDelete?: boolean;
}

export function DeckDialog(props: DeckDialogProps) {
  // 单信号：-1 表示未选中，>=0 表示已选中待确认
  const [deletingIndex, setDeletingIndex] = createSignal(-1);

  const sortedDeck = createMemo(() =>
    sortByCardId(props.run().deck.map((cardId) => ({ cardId }))),
  );

  const handleCardClick = (originalIndex: number) => {
    if (!props.showDelete || !props.onDeleteCard) return;

    if (deletingIndex() === originalIndex) {
      // 二次点击 → 确认删除
      props.onDeleteCard(originalIndex);
      setDeletingIndex(-1);
    } else {
      setDeletingIndex(originalIndex);
    }
  };

  const handleCancel = () => setDeletingIndex(-1);

  return (
    <Show when={props.show()}>
      <div class="pve-deck-dialog-overlay" onClick={props.onClose}>
        <div class="pve-deck-dialog" onClick={(e) => e.stopPropagation()}>
          <div class="pve-deck-dialog-header">
            <h3>当前卡组 ({props.run().deck.length} 张)</h3>
            <button class="pve-deck-dialog-close" onClick={props.onClose}>×</button>
          </div>
          <div class="pve-deck-dialog-content">
            <div class="pve-deck-dialog-grid">
              <For each={sortedDeck()}>
                {(item) => {
                  const name = getCardName(item.cardId);
                  const desc = getCardDescription(item.cardId);
                  return (
                    <div
                      class={`pve-deck-dialog-item ${deletingIndex() === item.originalIndex ? "pve-deck-dialog-item-deleting" : ""}`}
                      onClick={() => handleCardClick(item.originalIndex)}
                    >
                      <SafeImage class="pve-deck-dialog-img" entityId={item.cardId} alt={name} loading="lazy" />
                      <div class="pve-deck-dialog-name">{name}</div>
                      {desc && <div class="pve-card-tooltip">{desc}</div>}
                      <Show when={deletingIndex() === item.originalIndex}>
                        <div class="pve-deck-dialog-delete-hint">再点确认删除</div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
          <Show when={props.showDelete && deletingIndex() >= 0}>
            <div class="pve-deck-dialog-footer">
              <button class="pve-deck-dialog-cancel" onClick={handleCancel}>取消删除</button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
