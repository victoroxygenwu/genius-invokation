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

import { For, Show, createMemo, createSignal } from "solid-js";
import {
  snapWeight,
  pairKey,
  CardWeightManager,
  type SuggestedPair,
} from "@gi-tcg/roguelike";
import { getCardName } from "./roguelike-assets";
import { configStore } from "./configStore";
import { SafeImage } from "./SafeImage";
import { useDragSelect } from "./useDragSelect";
import { EditorToolbar } from "./EditorToolbar";

export interface CardWeightEditorProps {
  cardPool: { cardId: number; name: string }[];
  characterPool?: { id: number; name: string }[];
  suggestedPairs?: SuggestedPair[];
}

const CATEGORY_LABELS: Record<string, string> = {
  talent: "天赋专属",
  resonance: "元素共鸣",
  weapon: "武器适配",
  element: "元素关联",
  nation: "国家关联",
  synergy: "效果协同",
  general: "通用互补",
};

const CATEGORY_COLORS: Record<string, string> = {
  talent: "#ff6b6b",
  resonance: "#ffa94d",
  weapon: "#69db7c",
  element: "#74c0fc",
  nation: "#b197fc",
  synergy: "#f06595",
  general: "#868e96",
};

interface WeightSliderProps {
  value: number;
  onChange: (snapped: number) => void;
  onInput?: (raw: number) => void;
  class?: string;
  sliderStyle?: string;
  onClick?: (e: MouseEvent) => void;
}

function WeightSlider(props: WeightSliderProps) {
  return (
    <>
      <input
        type="range" min="0.1" max="1" step="any"
        value={props.value}
        onInput={(e) => props.onInput?.(Number(e.currentTarget.value))}
        onChange={(e) => {
          const snapped = snapWeight(Number(e.currentTarget.value));
          props.onChange(snapped);
        }}
        class={`pve-weight-slider ${props.class ?? ""}`.trim()}
        style={props.sliderStyle ? { width: props.sliderStyle } : undefined}
        onClick={props.onClick}
      />
      <input
        type="number" min="0.1" max="1" step="0.1"
        value={props.value.toFixed(1)}
        onChange={(e) => {
          const v = Number(e.currentTarget.value);
          if (v >= 0.1 && v <= 1) {
            props.onChange(snapWeight(v));
          }
        }}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        class="input-field pve-weight-num-input"
        onClick={props.onClick}
      />
    </>
  );
}

export function CardWeightEditor(props: CardWeightEditorProps) {
  const [mainCard, setMainCard] = createSignal<number>(0);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [mode, setMode] = createSignal<"edit" | "add">("edit");
  // 批量调节：多选卡牌集合
  const [selectedCards, setSelectedCards] = createSignal<Set<number>>(new Set());
  // 是否进入多选模式
  const [multiSelectMode, setMultiSelectMode] = createSignal(false);
  // 批量调节：原始权重快照（用于撤销）
  const [batchOriginals, setBatchOriginals] = createSignal<Map<number, number>>(new Map());
  // 批量调节：当前拖拽值
  const [batchValue, setBatchValue] = createSignal(0.5);

  // 创建带持久化的管理器（构造时自动从 configStore 加载，写操作自动持久化）
  const manager = configStore.createCardWeightManager();

  /** 修改权重（自动持久化） */
  const saveWeight = (a: number, b: number, weight: number) => {
    manager.setCardWeight(a, b, weight);
  };

  const sortedCards = createMemo(() => {
    const actions = [...props.cardPool]
      .sort((a, b) => a.cardId - b.cardId)
      .map((c) => ({ id: c.cardId, name: c.name }));
    const chars = (props.characterPool ?? [])
      .sort((a, b) => a.id - b.id)
      .map((c) => ({ id: c.id, name: c.name }));
    return [...actions, ...chars];
  });

  /** 单次获取所有手动对（依赖 configStore 信号触发重读） */
  const allWeightPairs = createMemo(() => {
    configStore.cardWeights(); // 依赖信号以响应持久化
    return manager.getAllWeightPairs();
  });

  /** 未被采纳/忽略的建议（共享过滤逻辑） */
  const filteredSuggestions = createMemo(() => {
    const pairs = props.suggestedPairs ?? [];
    const dismissedSet = configStore.dismissed();
    const manualKeys = new Set(allWeightPairs().map((p) => pairKey(p.a, p.b)));
    return pairs.filter((p) => {
      const key = pairKey(p.a, p.b);
      return !dismissedSet.has(key) && !manualKeys.has(key);
    });
  });

  /** 建议查找表：cardId -> SuggestedPair（仅与 mainCard 相关） */
  const suggestionMap = createMemo(() => {
    const main = mainCard();
    const map = new Map<number, SuggestedPair>();
    if (main === 0) return map;
    for (const p of filteredSuggestions()) {
      if (p.a !== main && p.b !== main) continue;
      map.set(p.a === main ? p.b : p.a, p);
    }
    return map;
  });

  /** 获取建议的有效权重（类别自定义优先） */
  const effectiveWeight = (pair: SuggestedPair): number =>
    configStore.categoryWeights()[pair.category] ?? pair.weight;

  /** 主体卡的所有关联卡（列表 + 查找表一次构建） */
  const relatedData = createMemo(() => {
    const main = mainCard();
    const list: Array<{ id: number; weight: number; source: "manual" | "suggested"; pair?: SuggestedPair }> = [];
    const map = new Map<number, { weight: number; source: "manual" | "suggested"; pair?: SuggestedPair }>();
    if (main === 0) return { list, map };
    const seen = new Set<number>();
    for (const p of allWeightPairs()) {
      let other: number;
      if (p.a === main) other = p.b;
      else if (p.b === main) other = p.a;
      else continue;
      seen.add(other);
      const entry = { id: other, weight: p.weight, source: "manual" as const };
      list.push(entry);
      map.set(other, entry);
    }
    for (const [other, pair] of suggestionMap()) {
      if (seen.has(other)) continue;
      const entry = { id: other, weight: effectiveWeight(pair), source: "suggested" as const, pair };
      list.push(entry);
      map.set(other, entry);
    }
    // 按卡池顺序排（ID 升序），角色牌（4位ID）排在最后
    list.sort((a, b) => {
      const aIsChar = a.id < 10000;
      const bIsChar = b.id < 10000;
      if (aIsChar !== bIsChar) return aIsChar ? 1 : -1;
      return a.id - b.id;
    });
    return { list, map };
  });

  const relatedCards = () => relatedData().list;
  const relatedMap = () => relatedData().map;

  /** 按类别分组的建议 */
  const groupedSuggestions = createMemo(() => {
    const groups: Record<string, SuggestedPair[]> = {};
    for (const p of filteredSuggestions()) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  });

  const onCardClick = (cardId: number) => {
    const main = mainCard();
    if (main === 0) {
      setMainCard(cardId);
      exitMultiSelect();
      return;
    }
    if (mode() === "edit") {
      // 编辑模式：点击任何卡都重选为主体
      setMainCard(cardId);
      exitMultiSelect();
    } else {
      // 添加模式：切换关联
      if (main === cardId) return;
      const existing = manager.getDirectCardWeight(main, cardId);
      saveWeight(main, cardId, existing > 0 ? 0 : 0.5);
    }
  };

  const updateWeight = (cardId: number, value: number) => {
    saveWeight(mainCard(), cardId, value);
  };

  /** 批量调节：实时预览（自动持久化） */
  const applyBatchPreview = (value: number) => {
    const sel = selectedCards();
    manager.beginBatch();
    for (const r of relatedCards()) {
      if (sel.has(r.id)) manager.setCardWeight(mainCard(), r.id, value);
    }
    manager.endBatch();
  };

  /** 切换多选状态 */
  const toggleSelect = (cardId: number) => {
    const sel = new Set(selectedCards());
    if (sel.has(cardId)) {
      sel.delete(cardId);
    } else {
      sel.add(cardId);
      // 记录原始权重
      const orig = new Map(batchOriginals());
      const rel = relatedCards().find(r => r.id === cardId);
      if (rel && !orig.has(cardId)) orig.set(cardId, rel.weight);
      setBatchOriginals(orig);
    }
    setSelectedCards(sel);
  };

  /** 全选/取消全选 */
  const toggleSelectAll = () => {
    if (selectedCards().size === relatedCards().length) {
      setSelectedCards(new Set<number>());
      setBatchOriginals(new Map());
    } else {
      const orig = new Map<number, number>();
      for (const r of relatedCards()) orig.set(r.id, r.weight);
      setBatchOriginals(orig);
      setSelectedCards(new Set(relatedCards().map(r => r.id)));
    }
  };

  /** 确认批量调节 */
  const acceptBatch = () => {
    // 已通过 applyBatchPreview 自动持久化
    exitMultiSelect();
  };

  /** 撤销批量调节 */
  const rejectBatch = () => {
    const orig = batchOriginals();
    manager.beginBatch();
    for (const [id, weight] of orig) manager.setCardWeight(mainCard(), id, weight);
    manager.endBatch();
    exitMultiSelect();
  };

  /** 退出多选模式 */
  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedCards(new Set<number>());
    setBatchOriginals(new Map());
    setBatchValue(0.5);
  };

  /** 进入多选模式 */
  const enterMultiSelect = () => {
    setMultiSelectMode(true);
    setBatchOriginals(new Map());
    // batchValue 设为当前关联卡权重的中位数
    const weights = relatedCards().map(r => r.weight).sort((a, b) => a - b);
    const median = weights.length > 0 ? weights[Math.floor(weights.length / 2)] : 0.5;
    setBatchValue(snapWeight(median));
  };

  // 顶部网格拖拽：添加模式下批量添加/取消关联
  const gridDrag = useDragSelect({
    guard: () => mode() === "add" && mainCard() !== 0,
    excludeSelectors: ".pve-weight-slider, .pve-weight-num-input",
    excludeId: mainCard,
    isSelected: (id) => manager.getDirectCardWeight(mainCard(), id) > 0,
    toggle: (id) => {
      const main = mainCard();
      const existing = manager.getDirectCardWeight(main, id);
      saveWeight(main, id, existing > 0 ? 0 : 0.5);
    },
  });

  // 下方列表拖拽：多选模式下批量选中/取消
  const listDrag = useDragSelect({
    guard: () => multiSelectMode(),
    excludeSelectors: ".pve-weight-slider, .pve-weight-num-input",
    isSelected: (id) => selectedCards().has(id),
    toggle: toggleSelect,
  });

  const removeRelation = (cardId: number) => {
    saveWeight(mainCard(), cardId, 0);
  };

  const acceptSuggestion = (pair: SuggestedPair) => {
    manager.setCardWeight(pair.a, pair.b, effectiveWeight(pair));
  };

  const dismissSuggestion = (pair: SuggestedPair) => {
    const d = new Set(configStore.dismissed());
    d.add(pairKey(pair.a, pair.b));
    configStore.setDismissed([...d]);
  };

  const updateCategoryWeight = (category: string, weight: number) => {
    const cw = { ...configStore.categoryWeights() };
    cw[category] = weight;
    configStore.setCategoryWeights(cw);
  };

  const acceptCategory = (category: string) => {
    const pairs = groupedSuggestions()[category] ?? [];
    const w = configStore.categoryWeights()[category] ?? pairs[0]?.weight ?? 0.5;
    manager.beginBatch();
    for (const p of pairs) manager.setCardWeight(p.a, p.b, w);
    manager.endBatch();
  };

  return (
    <div class="pve-debug-section">
      {/* 顶部固定区域：工具栏 + 主体信息 */}
      <div class="pve-weight-sticky-top">
        <EditorToolbar
          filename="card-weights.json"
          getData={() => ({ version: 1, pairs: allWeightPairs() })}
          onImport={(config: { version?: number; pairs?: any[] }) => {
            if (config.pairs && Array.isArray(config.pairs)) manager.loadPairs(config.pairs);
          }}
          onReset={() => manager.resetToDefault()}
        >
          <span class="editor-autosave-hint">✓ 自动保存</span>
        </EditorToolbar>

        <Show when={mainCard() !== 0}>
          <div class="pve-weight-top-bar">
            <div class="pve-weight-main-info">
              <span>主体: <b>{getCardName(mainCard())}</b></span>
              <span class="pve-weight-main-count">({relatedCards().length} 关联)</span>
              <Show when={mode() === "add"}>
                <button onClick={() => setMainCard(0)} class="btn-sm pve-weight-clear">重选</button>
              </Show>
            </div>
            <div class="pve-weight-mode-bar">
              <button class={`pve-weight-mode-btn ${mode() === "edit" ? "pve-weight-mode-active" : ""}`} onClick={() => setMode("edit")}>✏️ 编辑</button>
              <button class={`pve-weight-mode-btn ${mode() === "add" ? "pve-weight-mode-active" : ""}`} onClick={() => setMode("add")}>➕ 添加</button>
            </div>
          </div>
        </Show>
        <Show when={mainCard() === 0}>
          <p class="pve-weight-hint">点击一张卡牌作为关联主体</p>
        </Show>
      </div>

      <div class="card-grid pve-weight-grid"
        onPointerDown={gridDrag.onPointerDown}
        onPointerUp={gridDrag.onPointerUp}
        onPointerLeave={gridDrag.onPointerLeave}
        onPointerMove={gridDrag.onPointerMove}
      >
        <For each={sortedCards()}>
          {(card) => {
            const rel = () => relatedMap().get(card.id);
            const st = () => {
              const main = mainCard();
              if (main === 0) return "normal";
              if (card.id === main) return "main";
              const r = rel();
              if (!r) return "normal";
              return r.source === "manual" ? "related-manual" : "related-suggested";
            };
            return (
              <button
                class={`card-item pve-weight-card ${st() === "main" ? "pve-weight-card-main" : ""} ${st() === "related-manual" ? "card-item-selected pve-weight-card-selected" : ""} ${st() === "related-suggested" ? "pve-weight-card-suggested" : ""}`}
                data-card-id={card.id}
                onClick={() => onCardClick(card.id)}
              >
                <SafeImage entityId={card.id} alt={card.name} loading="lazy" />
                <span>{card.name}</span>
                <Show when={st() === "related-manual"}>
                  <span class="pve-weight-badge">{rel()!.weight.toFixed(1)}</span>
                </Show>
                <Show when={st() === "related-suggested"}>
                  <span class="pve-weight-badge-suggest">{rel()!.weight.toFixed(1)}</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      <Show when={mainCard() !== 0 && relatedCards().length > 0}>
        {/* 多选工具栏 */}
        <div class="pve-weight-toolbar">
          <Show when={!multiSelectMode()}>
            <button onClick={enterMultiSelect} class="btn-sm pve-weight-toolbar-btn">☑ 多选</button>
          </Show>
          <Show when={multiSelectMode()}>
            <button onClick={toggleSelectAll} class="btn-sm pve-weight-toolbar-btn">
              {selectedCards().size === relatedCards().length ? "取消全选" : "全选"}
            </button>
            <button onClick={exitMultiSelect} class="btn-sm pve-weight-toolbar-btn">取消多选</button>
          </Show>
        </div>

        {/* 批量调节滑块 */}
        <Show when={multiSelectMode() && selectedCards().size > 0}>
          <div class="pve-weight-batch-bar">
            <span class="pve-weight-batch-label">批量调节（{selectedCards().size} 张）</span>
            <WeightSlider
              value={batchValue()}
              onInput={(raw) => setBatchValue(raw)}
              onChange={(snapped) => {
                setBatchValue(snapped);
                applyBatchPreview(snapped);
              }}
            />
            <button onClick={acceptBatch} class="btn-sm btn-sm-green pve-weight-batch-accept">✓</button>
            <button onClick={rejectBatch} class="btn-sm btn-sm-red pve-weight-batch-reject">✕</button>
          </div>
        </Show>

        <div class="pve-weight-rel-list"
          onPointerDown={listDrag.onPointerDown}
          onPointerUp={listDrag.onPointerUp}
          onPointerLeave={listDrag.onPointerLeave}
          onPointerMove={listDrag.onPointerMove}
        >
          <For each={relatedCards()}>
            {(rel) => (
              <div class={`pve-weight-rel-item${selectedCards().has(rel.id) ? " pve-weight-rel-selected" : ""}${rel.source === "suggested" ? " pve-weight-rel-suggested" : ""}`}
                data-card-id={rel.id}
              >
                <Show when={multiSelectMode()}>
                  <input
                    type="checkbox"
                    checked={selectedCards().has(rel.id)}
                    class="pve-weight-rel-check"
                  />
                </Show>
                <SafeImage entityId={rel.id} alt={getCardName(rel.id)} class="pve-weight-rel-img" />
                <div class="pve-weight-rel-info">
                  <span class="pve-weight-rel-name">{getCardName(rel.id)}</span>
                  <Show when={rel.source === "suggested" && rel.pair}>
                    <span class="pve-weight-rel-reason" style={{ color: CATEGORY_COLORS[rel.pair!.category] }}>
                      {rel.pair!.reason}
                    </span>
                  </Show>
                </div>
                <WeightSlider
                  value={rel.weight}
                  onChange={(snapped) => {
                    if (rel.source === "suggested" && rel.pair) acceptSuggestion(rel.pair);
                    updateWeight(rel.id, snapped);
                  }}
                />
                <button onClick={() => removeRelation(rel.id)} onPointerDown={(e) => e.stopPropagation()} class="btn-sm btn-sm-red pve-weight-remove">✕</button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={(props.suggestedPairs?.length ?? 0) > 0}>
        <div class="pve-weight-suggest-toggle">
          <button onClick={() => setShowSuggestions(!showSuggestions())} class="editor-btn editor-btn-blue">
            {showSuggestions() ? "收起自动分析 ▲" : `展开自动分析 (${filteredSuggestions().length} 条) ▼`}
          </button>
        </div>
      </Show>

      <Show when={showSuggestions()}>
        <div class="pve-weight-suggestions">
          {Object.entries(groupedSuggestions()).map(([category, pairs]) => {
            const defaultW = pairs[0]?.weight ?? 0.5;
            const currentW = () => configStore.categoryWeights()[category] ?? defaultW;
            return (
            <div class="pve-weight-suggest-group" data-category={category}>
              <div class="pve-weight-suggest-header">
                <span class="pve-weight-suggest-category" style={{ color: CATEGORY_COLORS[category] }}>
                  ● {CATEGORY_LABELS[category] ?? category}
                </span>
                <span class="pve-weight-suggest-count">({pairs.length})</span>
                <WeightSlider
                  value={currentW()}
                  onInput={(raw) => updateCategoryWeight(category, raw)}
                  onChange={(snapped) => updateCategoryWeight(category, snapped)}
                  sliderStyle="80px"
                  onClick={(e: MouseEvent) => e.stopPropagation()}
                />
                <button onClick={(e) => { e.stopPropagation(); acceptCategory(category); }} class="btn-sm btn-sm-green pve-weight-accept-all">全部采纳</button>
              </div>
              <div class="pve-weight-suggest-list">
                {pairs.slice(0, 20).map((pair) => (
                  <div class="pve-weight-suggest-item" data-key={pairKey(pair.a, pair.b)}>
                    <span class="pve-weight-suggest-names">{getCardName(pair.a)} ↔ {getCardName(pair.b)}</span>
                    <span class="pve-weight-suggest-weight">{effectiveWeight(pair).toFixed(1)}</span>
                    <span class="pve-weight-suggest-reason">{pair.reason}</span>
                    <button onClick={(e) => { e.stopPropagation(); acceptSuggestion(pair); }} class="btn-sm btn-sm-green pve-weight-accept">✓</button>
                    <button onClick={(e) => { e.stopPropagation(); dismissSuggestion(pair); }} class="btn-sm pve-weight-dismiss">✕</button>
                  </div>
                ))}
                {pairs.length > 20 && <div class="pve-weight-suggest-more">...还有 {pairs.length - 20} 对</div>}
              </div>
            </div>
          );
          })}
        </div>
      </Show>
    </div>
  );
}
