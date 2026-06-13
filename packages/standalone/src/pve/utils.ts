/**
 * 将数组按 cardId 升序排序，同时保留原始索引（用于引擎的按索引操作）。
 */
export function sortByCardId<T extends { cardId: number }>(
  items: readonly T[],
): (T & { originalIndex: number })[] {
  return items
    .map((item, index) => ({ ...item, originalIndex: index }))
    .sort((a, b) => a.cardId - b.cardId);
}
