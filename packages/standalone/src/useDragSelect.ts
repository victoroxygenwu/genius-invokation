export interface DragSelectOptions {
  /** 是否允许开始拖拽（如模式检查） */
  guard: () => boolean;
  /** 从 pointer 事件解析卡牌 ID，返回 null 表示忽略 */
  resolveId: (e: PointerEvent) => number | null;
  /** 切换某张卡的选中状态 */
  toggle: (cardId: number) => void;
  /** 查询某张卡是否已选中 */
  isSelected: (cardId: number) => boolean;
  /** 需要排除的卡牌 ID（如主体卡自身），命中时忽略该卡 */
  excludeId?: () => number;
}

/**
 * 拖拽批量选择 hook — 封装 pointer capture + dragState 模式。
 * 返回四个事件处理器，绑定到容器元素即可。
 */
export function useDragSelect(opts: DragSelectOptions) {
  let dragState: "select" | "deselect" | null = null;

  const resolve = (e: PointerEvent): number | null => {
    const id = opts.resolveId(e);
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
