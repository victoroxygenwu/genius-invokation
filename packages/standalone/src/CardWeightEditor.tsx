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

import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import {
  getImageUrl,
  FALLBACK_IMAGE,
  getCardName,
  getDirectCardWeight,
  setCardWeight,
  getAllWeightPairs,
  loadPairs,
  clearAllWeights,
  snapWeight,
  pairKey,
  type SuggestedPair,
} from "@gi-tcg/roguelike";

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

export function CardWeightEditor(props: CardWeightEditorProps) {
  const [mainCard, setMainCard] = createSignal<number>(0);
  const [version, setVersion] = createSignal(0);
  const [dismissed, setDismissed] = createSignal<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [categoryWeights, setCategoryWeights] = createSignal<Record<string, number>>({});
  const [mode, setMode] = createSignal<"edit" | "add">("edit");
  // 拖拽状态：正在拖动的卡 ID 和临时值（避免每帧触发保存和重计算）
  const [dragging, setDragging] = createSignal<{ id: number; value: number } | null>(null);
  // 批量调节：多选卡牌集合
  const [selectedCards, setSelectedCards] = createSignal<Set<number>>(new Set());
  // 是否进入多选模式
  const [multiSelectMode, setMultiSelectMode] = createSignal(false);
  // 批量调节：原始权重快照（用于撤销）
  const [batchOriginals, setBatchOriginals] = createSignal<Map<number, number>>(new Map());
  // 批量调节：当前拖拽值
  const [batchValue, setBatchValue] = createSignal(0.5);

  const STORAGE_KEY = "gi-tcg-card-weights";
  const DISMISSED_KEY = "gi-tcg-dismissed-suggestions";
  const CATEGORY_W_KEY = "gi-tcg-category-weights";

  /** 保存当前配置到 localStorage */
  const saveToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, pairs: getAllWeightPairs() }));
    } catch { /* quota exceeded, ignore */ }
  };

  /** 从 localStorage 加载配置 */
  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const config = JSON.parse(raw);
      if (!config.pairs || !Array.isArray(config.pairs)) return;
      const valid = config.pairs.filter((p: any) =>
        typeof p?.a === "number" && typeof p?.b === "number" && typeof p?.weight === "number"
      );
      loadPairs(valid);
    } catch { /* invalid JSON, ignore */ }
  };

  // 组件挂载时加载保存的配置
  onMount(() => {
    loadFromStorage();
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setDismissed(new Set(arr));
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(CATEGORY_W_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") setCategoryWeights(obj);
      }
    } catch { /* ignore */ }
    setVersion((n) => n + 1);
  });

  /** 修改权重并自动保存 */
  const saveWeight = (a: number, b: number, weight: number) => {
    setCardWeight(a, b, weight);
    saveToStorage();
    setVersion((n) => n + 1);
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

  /** 单次获取所有手动对（避免 3 个 memo 各自调用 getAllWeightPairs） */
  const allWeightPairs = createMemo(() => {
    version();
    return getAllWeightPairs();
  });

  /** 未被采纳/忽略的建议（共享过滤逻辑） */
  const filteredSuggestions = createMemo(() => {
    const pairs = props.suggestedPairs ?? [];
    const dismissedSet = dismissed();
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
    categoryWeights()[pair.category] ?? pair.weight;

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
      const existing = getDirectCardWeight(main, cardId);
      saveWeight(main, cardId, existing > 0 ? 0 : 0.5);
    }
  };

  const updateWeight = (cardId: number, value: number) => {
    saveWeight(mainCard(), cardId, value);
  };

  /** 批量调节：实时预览（不保存） */
  const applyBatchPreview = (value: number) => {
    const sel = selectedCards();
    for (const r of relatedCards()) {
      if (sel.has(r.id)) setCardWeight(mainCard(), r.id, value);
    }
    setVersion((n) => n + 1);
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
    saveToStorage();
    exitMultiSelect();
  };

  /** 撤销批量调节 */
  const rejectBatch = () => {
    const orig = batchOriginals();
    for (const [id, weight] of orig) setCardWeight(mainCard(), id, weight);
    saveToStorage();
    setVersion((n) => n + 1);
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

  const removeRelation = (cardId: number) => {
    saveWeight(mainCard(), cardId, 0);
  };

  const acceptSuggestion = (pair: SuggestedPair) => {
    saveWeight(pair.a, pair.b, effectiveWeight(pair));
  };

  const dismissSuggestion = (pair: SuggestedPair) => {
    const d = new Set(dismissed());
    d.add(pairKey(pair.a, pair.b));
    setDismissed(d);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...d])); } catch { /* ignore */ }
  };

  const updateCategoryWeight = (category: string, weight: number) => {
    const cw = { ...categoryWeights() };
    cw[category] = weight;
    setCategoryWeights(cw);
    try { localStorage.setItem(CATEGORY_W_KEY, JSON.stringify(cw)); } catch { /* ignore */ }
    setVersion((n) => n + 1);
  };

  const acceptCategory = (category: string) => {
    const pairs = groupedSuggestions()[category] ?? [];
    const w = categoryWeights()[category] ?? pairs[0]?.weight ?? 0.5;
    for (const p of pairs) setCardWeight(p.a, p.b, w);
    saveToStorage();
    setVersion((n) => n + 1);
  };

  /** 导出当前配置为 JSON 文件下载 */
  const exportConfig = () => {
    const config = { version: 1, pairs: allWeightPairs() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "card-weights.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  /** 从 JSON 文件导入配置 */
  const importConfig = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        if (!config.pairs || !Array.isArray(config.pairs)) {
          alert("无效的配置文件");
          return;
        }
        loadPairs(config.pairs);
        saveToStorage();
        setVersion((n) => n + 1);
      } catch {
        alert("解析失败，请检查文件格式");
      }
    };
    input.click();
  };

  return (
    <div class="pve-debug-section">
      <h3>🃏 卡牌关联编辑器</h3>

      {/* 导入/导出按钮 */}
      <div class="pve-weight-io-bar">
        <button onClick={exportConfig} class="pve-weight-io-btn">📥 导出配置</button>
        <button onClick={importConfig} class="pve-weight-io-btn">📤 导入配置</button>
      </div>

      <Show when={mainCard() !== 0}>
        <div class="pve-weight-top-bar">
          <div class="pve-weight-main-info">
            <span>主体: <b>{getCardName(mainCard())}</b></span>
            <span class="pve-weight-main-count">({relatedCards().length} 关联)</span>
            <Show when={mode() === "add"}>
              <button onClick={() => setMainCard(0)} class="pve-weight-clear">重选</button>
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

      <div class="pve-weight-grid">
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
                class={`pve-weight-card ${st() === "main" ? "pve-weight-card-main" : ""} ${st() === "related-manual" ? "pve-weight-card-selected" : ""} ${st() === "related-suggested" ? "pve-weight-card-suggested" : ""}`}
                onClick={() => onCardClick(card.id)}
              >
                <img src={getImageUrl(card.id)} alt={card.name} loading="lazy" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
                <span>{card.name}</span>
                <Show when={st() === "related-manual"}>
                  <span class="pve-weight-badge">{(dragging()?.id === card.id ? dragging()!.value : rel()!.weight).toFixed(1)}</span>
                </Show>
                <Show when={st() === "related-suggested"}>
                  <span class="pve-weight-badge-suggest">{(dragging()?.id === card.id ? dragging()!.value : rel()!.weight).toFixed(1)}</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      <Show when={mainCard() !== 0 && relatedCards().length > 0}>
        {/* 工具栏 */}
        <div class="pve-weight-toolbar">
          <Show when={!multiSelectMode()}>
            <button onClick={enterMultiSelect} class="pve-weight-toolbar-btn">☑ 多选</button>
          </Show>
          <Show when={multiSelectMode()}>
            <button onClick={toggleSelectAll} class="pve-weight-toolbar-btn">
              {selectedCards().size === relatedCards().length ? "取消全选" : "全选"}
            </button>
            <button onClick={exitMultiSelect} class="pve-weight-toolbar-btn">取消多选</button>
          </Show>
        </div>

        {/* 批量调节滑块 */}
        <Show when={multiSelectMode() && selectedCards().size > 0}>
          <div class="pve-weight-batch-bar">
            <span class="pve-weight-batch-label">批量调节（{selectedCards().size} 张）</span>
            <input
              type="range" min="0.1" max="1" step="any"
              value={batchValue()}
              onInput={(e) => setBatchValue(Number(e.currentTarget.value))}
              onChange={(e) => {
                const snapped = snapWeight(Number(e.currentTarget.value));
                setBatchValue(snapped);
                applyBatchPreview(snapped);
              }}
              class="pve-weight-slider"
            />
            <input
              type="number" min="0.1" max="1" step="0.1"
              value={batchValue().toFixed(1)}
              onInput={(e) => setBatchValue(Number(e.currentTarget.value))}
              onChange={(e) => {
                const v = Number(e.currentTarget.value);
                if (v >= 0.1 && v <= 1) {
                  const snapped = snapWeight(v);
                  setBatchValue(snapped);
                  applyBatchPreview(snapped);
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              class="pve-weight-num-input"
            />
            <button onClick={acceptBatch} class="pve-weight-batch-accept">✓</button>
            <button onClick={rejectBatch} class="pve-weight-batch-reject">✕</button>
          </div>
        </Show>

        <div class="pve-weight-rel-list">
          <For each={relatedCards()}>
            {(rel) => (
              <div class={`pve-weight-rel-item ${selectedCards().has(rel.id) ? "pve-weight-rel-selected" : ""}`}>
                <Show when={multiSelectMode()}>
                  <input
                    type="checkbox"
                    checked={selectedCards().has(rel.id)}
                    onInput={() => toggleSelect(rel.id)}
                    class="pve-weight-rel-check"
                  />
                </Show>
                <img src={getImageUrl(rel.id)} alt={getCardName(rel.id)} class="pve-weight-rel-img" onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)} />
                <div class="pve-weight-rel-info">
                  <span class="pve-weight-rel-name">{getCardName(rel.id)}</span>
                  <Show when={rel.source === "suggested" && rel.pair}>
                    <span class="pve-weight-rel-reason" style={{ color: CATEGORY_COLORS[rel.pair!.category] }}>
                      {rel.pair!.reason}
                    </span>
                  </Show>
                </div>
                <input
                  type="range" min="0.1" max="1" step="any"
                  value={dragging()?.id === rel.id ? dragging()!.value : rel.weight}
                  onInput={(e) => setDragging({ id: rel.id, value: Number(e.currentTarget.value) })}
                  onChange={(e) => {
                    const snapped = snapWeight(Number(e.currentTarget.value));
                    if (rel.source === "suggested" && rel.pair) acceptSuggestion(rel.pair);
                    updateWeight(rel.id, snapped);
                    setDragging(null);
                  }}
                  class="pve-weight-slider"
                />
                <input
                  type="number" min="0.1" max="1" step="0.1"
                  value={(dragging()?.id === rel.id ? dragging()!.value : rel.weight).toFixed(1)}
                  onInput={(e) => setDragging({ id: rel.id, value: Number(e.currentTarget.value) })}
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (v >= 0.1 && v <= 1) {
                      if (rel.source === "suggested" && rel.pair) acceptSuggestion(rel.pair);
                      updateWeight(rel.id, snapWeight(v));
                    }
                    setDragging(null);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  class="pve-weight-num-input"
                />
                <button onClick={() => removeRelation(rel.id)} class="pve-weight-remove">✕</button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={(props.suggestedPairs?.length ?? 0) > 0}>
        <div class="pve-weight-suggest-toggle">
          <button onClick={() => setShowSuggestions(!showSuggestions())} class="pve-weight-suggest-btn">
            {showSuggestions() ? "收起自动分析 ▲" : `展开自动分析 (${filteredSuggestions().length} 条) ▼`}
          </button>
        </div>
      </Show>

      <Show when={showSuggestions()}>
        <div class="pve-weight-suggestions">
          {Object.entries(groupedSuggestions()).map(([category, pairs]) => {
            const defaultW = pairs[0]?.weight ?? 0.5;
            const currentW = () => categoryWeights()[category] ?? defaultW;
            return (
            <div class="pve-weight-suggest-group" data-category={category}>
              <div class="pve-weight-suggest-header">
                <span class="pve-weight-suggest-category" style={{ color: CATEGORY_COLORS[category] }}>
                  ● {CATEGORY_LABELS[category] ?? category}
                </span>
                <span class="pve-weight-suggest-count">({pairs.length})</span>
                <input
                  type="range" min="0.1" max="1" step="any"
                  value={currentW()}
                  onInput={(e) => {
                    // 只更新类别权重信号，不触发 memo 重算
                    const cw = { ...categoryWeights() };
                    cw[category] = Number(e.currentTarget.value);
                    setCategoryWeights(cw);
                  }}
                  onChange={(e) => {
                    const snapped = snapWeight(Number(e.currentTarget.value));
                    updateCategoryWeight(category, snapped);
                  }}
                  class="pve-weight-slider" style={{ width: "80px" }}
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  type="number" min="0.1" max="1" step="0.1"
                  value={currentW().toFixed(1)}
                  onInput={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (v >= 0.1 && v <= 1) updateCategoryWeight(category, snapWeight(v));
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  class="pve-weight-num-input"
                  onClick={(e) => e.stopPropagation()}
                />
                <button onClick={(e) => { e.stopPropagation(); acceptCategory(category); }} class="pve-weight-accept-all">全部采纳</button>
              </div>
              <div class="pve-weight-suggest-list">
                {pairs.slice(0, 20).map((pair) => (
                  <div class="pve-weight-suggest-item" data-key={pairKey(pair.a, pair.b)}>
                    <span class="pve-weight-suggest-names">{getCardName(pair.a)} ↔ {getCardName(pair.b)}</span>
                    <span class="pve-weight-suggest-weight">{effectiveWeight(pair).toFixed(1)}</span>
                    <span class="pve-weight-suggest-reason">{pair.reason}</span>
                    <button onClick={(e) => { e.stopPropagation(); acceptSuggestion(pair); }} class="pve-weight-accept">✓</button>
                    <button onClick={(e) => { e.stopPropagation(); dismissSuggestion(pair); }} class="pve-weight-dismiss">✕</button>
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
