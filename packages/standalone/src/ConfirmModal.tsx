import { Show, createSignal } from "solid-js";

export interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal(props: ConfirmModalProps) {
  return (
    <div class="confirm-modal-overlay" onClick={props.onCancel}>
      <div class="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <p class="confirm-modal-message">{props.message}</p>
        <div class="confirm-modal-actions">
          <button class="editor-btn" onClick={props.onCancel}>取消</button>
          <button class="editor-btn editor-btn-save" onClick={props.onConfirm}>确定</button>
        </div>
      </div>
    </div>
  );
}

/** 创建可复用的确认对话框控制器 */
export function createConfirm() {
  const [state, setState] = createSignal<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = (message: string): Promise<boolean> =>
    new Promise((resolve) => setState({ message, resolve }));

  const Modal = () => (
    <Show when={state()}>
      <ConfirmModal
        message={state()!.message}
        onConfirm={() => { state()!.resolve(true); setState(null); }}
        onCancel={() => { state()!.resolve(false); setState(null); }}
      />
    </Show>
  );

  return { confirm, Modal };
}
