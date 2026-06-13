export interface DragSelectOptions {
  /** 是否允许开始拖拽（如模式检查） */
  guard: () => boolean;
  /** 从 pointer 事件解析卡牌 ID，默认从 [data-card-id] 属性读取 */
  resolveId?: (e: PointerEvent) => number | null;
  /** 排除的 CSS 选择器（如滑块、数字输入），命中时返回 null */
  excludeSelectors?: string;
  /** 切换某张卡的选中状态 */
  toggle: (cardId: number) => void;
  /** 查询某张卡是否已选中 */
  isSelected: (cardId: number) => boolean;
  /** 需要排除的卡牌 ID（如主体卡自身），命中时忽略该卡 */
  excludeId?: () => number;
}

/** 默认 resolveId：从 [data-card-id] 属性读取卡牌 ID */
function defaultResolveId(e: PointerEvent, excludeSelectors?: string): number | null {
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  if (!el) return null;
  if (excludeSelectors && el.closest(excludeSelectors)) return null;
  const item = el.closest("[data-card-id]") as HTMLElement | null;
  if (!item) return null;
  return Number(item.dataset.cardId) || null;
}

/**
 * 拖拽批量选择 hook — 封装 pointer capture + dragState 模式。
 * 返回四个事件处理器，绑定到容器元素即可。
 */
export function useDragSelect(opts: DragSelectOptions) {
  let dragState: "select" | "deselect" | null = null;

  const resolve = (e: PointerEvent): number | null => {
    const id = opts.resolveId ? opts.resolveId(e) : defaultResolveId(e, opts.excludeSelectors);
    if (!id) return null;
    if (opts.excludeId?.() === id) return null;
    return id;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!opts.guard()) return;
    const cardId = resolve(e);
    if (!cardId) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const wasSelected = opts.isSelected(cardId);
    dragState = wasSelected ? "deselect" : "select";
    opts.toggle(cardId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragState || !opts.guard()) return;
    const cardId = resolve(e);
    if (!cardId) return;
    const selected = opts.isSelected(cardId);
    if (dragState === "select" && !selected) opts.toggle(cardId);
    else if (dragState === "deselect" && selected) opts.toggle(cardId);
  };

  const resetDrag = () => { dragState = null; };

  return { onPointerDown, onPointerMove, onPointerUp: resetDrag, onPointerLeave: resetDrag };
}
