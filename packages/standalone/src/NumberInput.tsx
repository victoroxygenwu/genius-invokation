import { createSignal, createEffect } from "solid-js";

/** 数字输入框：使用内部 signal 避免 SolidJS 失焦问题 */
export function NumberInput(p: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  class?: string;
}) {
  const [local, setLocal] = createSignal(String(p.value));
  const [editing, setEditing] = createSignal(false);
  // 非编辑状态时，从外部值同步
  createEffect(() => {
    if (!editing()) {
      setLocal(String(p.value));
    }
  });
  return (
    <input
      type="number"
      min={p.min ?? 1}
      max={p.max ?? 999}
      class={`input-field ${p.class ?? ""}`}
      value={local()}
      onFocus={() => {
        setEditing(true);
        setLocal(String(p.value));
      }}
      onInput={(e) => {
        setLocal(e.target.value);
        const n = parseInt(e.target.value);
        if (!isNaN(n)) p.onChange(n);
      }}
      onBlur={() => {
        setEditing(false);
      }}
    />
  );
}
