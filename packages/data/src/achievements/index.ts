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
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import type { AchievementDefinition } from "@gi-tcg/core";

// ─── 在此导入所有成就定义 ─────────────────────────────────────
// 命名规范：ACH_XXXX，XXXX 为成就 ID
// 新增成就只需：1) 创建 XXXX.ts 文件  2) 在下方加一行 import
import { ACH_1001 } from "./1001";
import { ACH_2001 } from "./2001";
import { ACH_2002 } from "./2002";
import { ACH_3001 } from "./3001";

// ─── 导出单个成就（供外部按需引用）─────────────────────────────
export { ACH_1001 } from "./1001";
export { ACH_2001 } from "./2001";
export { ACH_2002 } from "./2002";
export { ACH_3001 } from "./3001";

// ─── 正式成就列表 ──────────────────────────────────────────────
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  ACH_1001,
  ACH_2001,
  ACH_2002,
  ACH_3001,
];
