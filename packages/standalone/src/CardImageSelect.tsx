import { For, Show, createSignal, createMemo } from "solid-js";
import type { CardEntry } from "@gi-tcg/roguelike";
import { SafeImage } from "./SafeImage";

/**
 * 卡牌选择器 — 与 EventEditor 的 IdPicker 一致：触发按钮 + overlay 模态列表。
 * 列表使用 ee-picker-item 样式（一行一个小图+名称），不是网格。
 */
export function CardImageSelect(p: {
  value: number;
  items: CardEntry[];
  onChange: (id: number) => void;
  placeholder?: string;
  specialOptions?: { value: number; label: string }[];
}) {
  const [open, setOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const current = () => p.items.find((it) => it.id === p.value);
  const specialLabel = () => p.specialOptions?.find((o) => o.value === p.value)?.label;

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    if (!q) return p.items;
    return p.items.filter((it) => it.name.toLowerCase().includes(q) || String(it.id).includes(q));
  });

  const handleSelect = (id: number) => {
    p.onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <button class="ee-picker-btn" onClick={() => setOpen(true)}>
        <Show when={current()} fallback={
          <Show when={specialLabel()} fallback={<span>{p.placeholder ?? "选择..."}</span>}>
            <span>{specialLabel()}</span>
          </Show>
        }>
          <SafeImage entityId={p.value} style={{ width: "20px", height: "20px", "border-radius": "3px", "object-fit": "cover", "object-position": "top center" }} />
          <span>{current()!.name}</span>
        </Show>
      </button>
      <Show when={open()}>
        <div class="ee-picker-overlay" onClick={() => { setOpen(false); setSearch(""); }}>
          <div class="ee-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div class="ee-picker-header">
              <input
                class="input-field"
                type="text"
                placeholder="搜索名称或ID..."
                value={search()}
                onInput={(e) => setSearch(e.target.value)}
              />
              <button class="editor-btn" onClick={() => { setOpen(false); setSearch(""); }}>关闭</button>
            </div>
            <div class="ee-picker-list">
              <For each={p.specialOptions}>{(opt) => (
                <button
                  class={`ee-picker-item ${p.value === opt.value ? "ee-picker-item-selected" : ""}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span class="ee-picker-item-name">{opt.label}</span>
                </button>
              )}</For>
              <For each={filtered()}>
                {(item) => (
                  <button
                    class={`ee-picker-item ${p.value === item.id ? "ee-picker-item-selected" : ""}`}
                    onClick={() => handleSelect(item.id)}
                  >
                    <SafeImage entityId={item.id} style={{ width: "28px", height: "28px", "border-radius": "3px", "object-fit": "cover", "object-position": "top center", "flex-shrink": "0" }} />
                    <span class="ee-picker-item-name">{item.name}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
