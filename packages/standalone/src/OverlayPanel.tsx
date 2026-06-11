import { type JSX } from "solid-js";

interface OverlayPanelProps {
  title: string;
  onClose: () => void;
  maxWidth?: string;
  zIndex?: number;
  children: JSX.Element;
  titleActions?: JSX.Element;
}

export function OverlayPanel(props: OverlayPanelProps) {
  return (
    <div class="editor-overlay" style={{ "z-index": String(props.zIndex ?? 1000) }}>
      <div class="editor-panel" style={{ "max-width": props.maxWidth ?? "900px" }}>
        <div class="editor-title-bar">
          <h2>{props.title}</h2>
          <div class="editor-title-actions">
            {props.titleActions}
            <button class="editor-btn" onClick={props.onClose}>✕</button>
          </div>
        </div>
        <div class="editor-content">
          {props.children}
        </div>
      </div>
    </div>
  );
}
