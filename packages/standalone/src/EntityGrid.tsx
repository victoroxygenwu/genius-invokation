// Copyright (C) 2024-2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { For, Show, createMemo, createSignal, type JSX } from "solid-js";
import { SafeImage } from "./SafeImage";

// ============================================================
// 统一实体选择网格
// ============================================================

export interface EntityGridItem {
  id: number;
  name: string;
}

export interface EntityGridProps<T extends EntityGridItem> {
  items: T[];
  /** 选择模式 */
  mode?: "single" | "multi";
  /** 当前选中的 ID 集合（multi 模式）或单个 ID（single 模式） */
  selected?: Set<number> | number;
  /** 点击回调。single 模式传 id；multi 模式传 id + 当前 selected 集合 */
  onChange?: (id: number, selected?: Set<number>) => void;
  /** 额外的 CSS class */
  class?: string;
  /** 渲染徽章（费用/权重等），显示在卡片右下角 */
  badge?: (item: T) => JSX.Element;
  /** 渲染额外内容（元素标签等），显示在名称下方 */
  extra?: (item: T) => JSX.Element;
  /** 是否显示搜索框 */
  searchable?: boolean;
  /** 搜索占位文本 */
  searchPlaceholder?: string;
  /** 最大显示数量 */
  maxItems?: number;
  /** 多选模式下最大选择数量（0 = 不限） */
  maxSelect?: number;
  /** 卡片项的额外 CSS class */
  itemClass?: string | ((item: T, selected: boolean) => string);
}

export function EntityGrid<T extends EntityGridItem>(props: EntityGridProps<T>) {
  const [search, setSearch] = createSignal("");

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    let items = props.items;
    if (q) {
      items = items.filter(
        (it) => it.name.toLowerCase().includes(q) || String(it.id).includes(q)
      );
    }
    const max = props.maxItems;
    return max ? items.slice(0, max) : items;
  });

  const isSelected = (id: number): boolean => {
    const sel = props.selected;
    if (sel === undefined) return false;
    if (typeof sel === "number") return sel === id;
    return sel.has(id);
  };

  const handleClick = (id: number) => {
    const mode = props.mode ?? "single";
    if (mode === "single") {
      props.onChange?.(id);
      return;
    }
    // multi 模式
    const current = props.selected instanceof Set ? new Set(props.selected) : new Set<number>();
    if (current.has(id)) {
      current.delete(id);
    } else {
      const max = props.maxSelect ?? 0;
      if (max > 0 && current.size >= max) return;
      current.add(id);
    }
    props.onChange?.(id, current);
  };

  const resolveItemClass = (item: T, selected: boolean): string => {
    const base = "card-item eg-item";
    const sel = selected ? " card-item-selected eg-item-selected" : "";
    const extra = typeof props.itemClass === "function"
      ? props.itemClass(item, selected)
      : (props.itemClass ?? "");
    return `${base}${sel} ${extra}`.trim();
  };

  return (
    <div class={`eg-container ${props.class ?? ""}`.trim()}>
      <Show when={props.searchable}>
        <input
          class="input-field eg-search"
          type="text"
          placeholder={props.searchPlaceholder ?? "搜索名称或ID..."}
          value={search()}
          onInput={(e) => setSearch(e.target.value)}
        />
      </Show>
      <div class="card-grid eg-grid">
        <For each={filtered()}>
          {(item) => {
            const sel = () => isSelected(item.id);
            return (
              <button
                class={resolveItemClass(item, sel())}
                onClick={() => handleClick(item.id)}
              >
                <SafeImage entityId={item.id} alt={item.name} loading="lazy" />
                <span class="eg-name">{item.name}</span>
                <Show when={props.extra}>
                  <div class="eg-extra">{props.extra!(item)}</div>
                </Show>
                <Show when={props.badge}>
                  <span class="eg-badge">{props.badge!(item)}</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
}
