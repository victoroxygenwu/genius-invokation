import { type JSX, createSignal, onCleanup, createEffect } from "solid-js";

/**
 * 通用 toast 通知 hook。
 *
 * 返回 showToast 函数和可渲染的 Toast 组件。
 * toast 在 2 秒后自动消失，组件卸载时自动清理定时器。
 */
export function createToast(opts?: { style?: JSX.CSSProperties }) {
  const [toast, setToast] = createSignal("");
  let timer: ReturnType<typeof setTimeout> | null = null;

  const showToast = (msg: string) => {
    if (timer) clearTimeout(timer);
    setToast(msg);
    timer = setTimeout(() => { timer = null; setToast(""); }, 2000);
  };
  onCleanup(() => { if (timer) clearTimeout(timer); });

  const Toast = () => {
    const el = document.createElement("div");
    el.className = "pve-toast";
    if (opts?.style) Object.assign(el.style, opts.style);
    el.style.display = "none";
    createEffect(() => {
      const msg = toast();
      if (msg) {
        el.textContent = msg;
        el.style.display = "";
      } else {
        el.style.display = "none";
      }
    });
    return el;
  };

  return { showToast, Toast } as const;
}
