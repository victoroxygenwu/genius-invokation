import { createSignal, createEffect, onCleanup } from "solid-js";

/**
 * 通用自动保存 hook。
 *
 * 从 configStore 读取初始值 → 克隆到本地 signal → debounce 300ms 后写回。
 *
 * @param load   - 从 configStore 读取当前值
 * @param save   - 写回 configStore
 * @param fallback - configStore 为空时使用的默认值
 * @returns [local, setLocal] 本地可编辑的 signal
 */
export function useAutoSave<T>(
  load: () => T,
  save: (data: T) => void,
  fallback: T,
) {
  const [local, setLocal] = createSignal<T>(
    structuredClone(load() ?? fallback)
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const data = local();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => save(data), 300);
    onCleanup(() => { if (timer) clearTimeout(timer); });
  });

  return [local, setLocal] as const;
}
