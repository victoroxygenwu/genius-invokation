import type { Accessor } from "solid-js";

export interface EditableListActions<T> {
  add: () => void;
  update: (i: number, item: T) => void;
  remove: (i: number) => void;
}

/**
 * 标准化可编辑列表的 add/update/remove 操作。
 * @param get - 获取当前列表的 accessor
 * @param set - 设置列表的函数（兼容 Signal setter 和回调模式）
 * @param defaultItem - 添加新项时的默认值构造函数
 */
export function useEditableList<T>(
  get: Accessor<T[]>,
  set: (items: T[]) => void,
  defaultItem: () => T,
): EditableListActions<T> {
  return {
    add: () => set([...get(), defaultItem()]),
    update: (i: number, item: T) => {
      const l = [...get()];
      l[i] = item;
      set(l);
    },
    remove: (i: number) => set(get().filter((_, idx) => idx !== i)),
  };
}
