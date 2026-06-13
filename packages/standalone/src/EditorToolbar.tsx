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

import { type JSX } from "solid-js";
import { exportJson, importJson } from "./configStore";
import { createConfirm } from "./ConfirmModal";
import { createToast } from "./createToast";

// ============================================================
// 统一编辑器工具栏
// ============================================================

export interface EditorToolbarProps<T> {
  /** 导出文件名 */
  filename: string;
  /** 导出数据 */
  getData: () => T;
  /** 导入回调 */
  onImport: (data: T) => void;
  /** 重置为预设回调 */
  onReset?: () => void;
  /** 额外的按钮 */
  children?: JSX.Element;
}

export function EditorToolbar<T>(props: EditorToolbarProps<T>) {
  const { confirm: customConfirm, Modal } = createConfirm();
  const { showToast, Toast } = createToast({
    style: { background: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)" },
  });

  const handleExport = async () => {
    const ok = await exportJson(props.getData(), props.filename);
    if (ok) showToast("导出成功");
  };

  const handleImport = async () => {
    const data = await importJson<T>();
    if (data) {
      props.onImport(data);
      showToast("导入成功");
    }
  };

  const handleReset = async () => {
    if (await customConfirm("确定要重置为预设数据吗？当前修改将丢失。")) {
      props.onReset?.();
    }
  };

  return (
    <div class="editor-toolbar">
      <button class="editor-btn" onClick={handleExport}>导出</button>
      <button class="editor-btn" onClick={handleImport}>导入</button>
      {props.onReset && <button class="editor-btn" onClick={handleReset}>重置预设</button>}
      {props.children}
      <Toast />
      <Modal />
    </div>
  );
}
