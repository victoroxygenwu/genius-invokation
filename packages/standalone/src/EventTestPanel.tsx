import { For, Show, createSignal, createMemo } from "solid-js";
import getData from "@gi-tcg/data";
import { CURRENT_VERSION } from "@gi-tcg/core";
import {
  DEFAULT_EVENTS,
  getEffectDescription,
  type EventDefinition,
  type RoguelikeRunManager,
} from "@gi-tcg/roguelike";
import { getEvents } from "./configStore";
import { OverlayPanel } from "./OverlayPanel";

const data = getData(CURRENT_VERSION);

export interface EventTestPanelProps {
  runManager: () => RoguelikeRunManager;
  onClose: () => void;
}

export function EventTestPanel(props: EventTestPanelProps) {
  // 从 configStore 加载事件，如果没有则使用默认事件
  const allEvents = createMemo(() => {
    const stored = getEvents();
    return stored.length > 0 ? stored : DEFAULT_EVENTS;
  });

  const [selectedEvent, setSelectedEvent] = createSignal<EventDefinition | null>(null);
  const [filter, setFilter] = createSignal<"all" | "positive" | "negative">("all");

  const filteredEvents = createMemo(() => {
    const f = filter();
    if (f === "all") return allEvents();
    return allEvents().filter((e) => e.eventTag === f);
  });

  const confirmTestEvent = () => {
    const event = selectedEvent();
    if (!event) return;
    // 应用事件效果到当前 run
    const rm = props.runManager();
    rm.debugApplyEvent(event);
    setSelectedEvent(null);
  };

  return (
    <OverlayPanel title="📜 事件测试" onClose={props.onClose} maxWidth="900px"
      titleActions={
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button class={`editor-btn ${filter() === "all" ? "editor-btn-blue" : ""}`}
            onClick={() => setFilter("all")}>全部 ({allEvents().length})</button>
          <button class={`editor-btn ${filter() === "positive" ? "editor-btn-blue" : ""}`}
            onClick={() => setFilter("positive")}>
            ✨ 正面 ({allEvents().filter((e) => e.eventTag === "positive").length})
          </button>
          <button class={`editor-btn ${filter() === "negative" ? "editor-btn-blue" : ""}`}
            onClick={() => setFilter("negative")}>
            💀 负面 ({allEvents().filter((e) => e.eventTag === "negative").length})
          </button>
        </div>
      }
    >
      <>
        <Show when={selectedEvent() === null}>
          <p class="le-hint">点击任意事件查看详细信息并测试效果。事件将应用到当前测试运行中。</p>
          <div class="pve-event-gallery">
            <For each={filteredEvents()}>
              {(event) => (
                <div class="pve-event-gallery-item" onClick={() => setSelectedEvent(event)}>
                  <div class="pve-event-gallery-img">
                    <Show when={event.imageUrl} fallback={
                      <span>{event.eventTag === "positive" ? "✨" : "💀"}</span>
                    }>
                      <img src={event.imageUrl} alt={event.name} />
                    </Show>
                  </div>
                  <div class="pve-event-gallery-info">
                    <div class="pve-event-gallery-name">{event.name}</div>
                    <div class={`pve-event-gallery-tag ${event.eventTag === "positive" ? "pve-event-gallery-tag-positive" : "pve-event-gallery-tag-negative"}`}>
                      {event.eventTag === "positive" ? "✨ 正面" : "💀 负面"}
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
          <Show when={filteredEvents().length === 0}>
            <p class="pve-debug-hint">没有找到匹配的事件</p>
          </Show>
        </Show>

        <Show when={selectedEvent() !== null}>
          {(() => {
            const event = selectedEvent()!;
            const rm = props.runManager();
            const renderedText = rm.renderEventText(event.storyTemplate);
            const effectDescs = event.effects.map((e) => getEffectDescription(e, data));
            return (
              <div class="pve-event" style={{ "text-align": "left" }}>
                <button class="editor-btn" onClick={() => setSelectedEvent(null)}
                  style={{ "margin-bottom": "1rem" }}>← 返回列表</button>

                <h2 style={{ "text-align": "center" }}>
                  {event.eventTag === "positive" ? "✨" : "💀"} {event.name}
                </h2>

                <Show when={event.imageUrl}>
                  <img class="pve-event-image" src={event.imageUrl} alt={event.name} />
                </Show>
                <Show when={!event.imageUrl}>
                  <div class="pve-event-image-placeholder">
                    {event.eventTag === "positive" ? "✨" : "💀"}
                  </div>
                </Show>

                <p class="pve-event-story">{renderedText}</p>

                <Show when={event.conditions.length > 0}>
                  <div class="pve-event-effects">
                    <h3>触发条件</h3>
                    <For each={event.conditions}>{(cond) => (
                      <div class="pve-event-effect-item">
                        {cond.condition.type} — 权重: {cond.weight}
                      </div>
                    )}</For>
                  </div>
                </Show>

                <Show when={effectDescs.length > 0}>
                  <div class="pve-event-effects">
                    <h3>效果</h3>
                    <For each={effectDescs}>{(desc) => (
                      <div class="pve-event-effect-item">{desc}</div>
                    )}</For>
                  </div>
                </Show>

                <div class="pve-actions" style={{ "justify-content": "flex-start" }}>
                  <button class="editor-btn editor-btn-save" onClick={confirmTestEvent}>
                    应用效果到当前运行
                  </button>
                  <button class="editor-btn" onClick={() => setSelectedEvent(null)}>
                    取消
                  </button>
                </div>
              </div>
            );
          })()}
        </Show>
      </>
    </OverlayPanel>
  );
}
