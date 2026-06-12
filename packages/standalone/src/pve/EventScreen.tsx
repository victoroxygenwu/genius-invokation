import { For, Show, createSignal } from "solid-js";
import type { Accessor, JSX } from "solid-js";
import type { RoguelikeRun, RoguelikeRunManager } from "@gi-tcg/roguelike";
import { getCardName } from "@gi-tcg/roguelike";
import { SafeImage } from "../SafeImage";
import type { DebugMode } from "./HomeScreen";

export interface EventScreenProps {
  run: Accessor<RoguelikeRun>;
  runManager: Accessor<RoguelikeRunManager>;
  debugMode: Accessor<DebugMode>;
  onGoHome: () => void;
}

export function EventScreen(props: EventScreenProps): JSX.Element {
  const [eventDeletingIdx, setEventDeletingIdx] = createSignal(-1);
  const [eventCardPicked, setEventCardPicked] = createSignal(false);

  const event = () => props.run().currentEvent;

  const handleDeckCardClick = (i: number) => {
    if (eventDeletingIdx() === i) {
      props.runManager().eventRemoveCard(i);
      setEventDeletingIdx(-1);
      setEventCardPicked(true);
    } else {
      setEventDeletingIdx(i);
    }
  };

  const confirmEvent = () => {
    setEventDeletingIdx(-1);
    setEventCardPicked(false);
    props.runManager().confirmEvent();
  };

  return (
    <Show when={event()} fallback={null}>
      {(ev) => {
        const renderedText = () => props.runManager().renderEventText(ev().storyTemplate);
        const effectDescs = () => props.runManager().getEventEffectDescriptions(ev());
        const needsCardPick = () => ev().effects.some((e) => e.type === "chooseAndRemoveCard") && !eventCardPicked();
        return (
          <div class="pve-event">
            <h2>📜 {ev().name}</h2>
            <Show when={ev().imageUrl}>
              <img class="pve-event-image" src={ev().imageUrl} alt={ev().name} />
            </Show>
            <Show when={!ev().imageUrl}>
              <div class="pve-event-image-placeholder">📜</div>
            </Show>
            <p class="pve-event-story">{renderedText()}</p>
            <Show when={effectDescs().length > 0}>
              <div class="pve-event-effects">
                <h3>效果</h3>
                <For each={effectDescs()}>{(desc) => (
                  <div class="pve-event-effect-item">{desc}</div>
                )}</For>
              </div>
            </Show>
            <Show when={needsCardPick()}>
              <div class="pve-deck-section">
                <h3>选择要删除的卡牌 ({props.run().deck.length} 张)</h3>
                <div class="pve-deck-items">
                  <For each={props.run().deck}>
                    {(cardId, index) => (
                      <button
                        class={`pve-deck-item ${eventDeletingIdx() === index() ? "pve-deck-item-deleting" : ""}`}
                        onClick={() => handleDeckCardClick(index())}
                      >
                        <SafeImage class="pve-deck-img" entityId={cardId} alt={getCardName(cardId)} loading="lazy" />
                        <div class="pve-deck-name">{getCardName(cardId)}</div>
                        <Show when={eventDeletingIdx() === index()}>
                          <div class="pve-deck-confirm">再点确认删除</div>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
                <Show when={eventDeletingIdx() >= 0}>
                  <button class="pve-deck-cancel" onClick={() => setEventDeletingIdx(-1)}>取消选择</button>
                </Show>
              </div>
            </Show>
            <div class="pve-actions">
              <Show when={!needsCardPick()} fallback={
                <span class="pve-event-hint">请先选择要删除的卡牌</span>
              }>
                <button onClick={confirmEvent}>确认</button>
              </Show>
              <Show when={props.debugMode() !== "off"}>
                <button onClick={props.onGoHome}>返回首页</button>
              </Show>
            </div>
          </div>
        );
      }}
    </Show>
  );
}
