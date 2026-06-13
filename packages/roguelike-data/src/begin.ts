// Copyright (C) 2025 Guyutongxue
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

import "./version-meta";
import { registry as baseRegistry } from "@gi-tcg/data";

/** 从官方数据 registry 克隆的 roguelike 专用 registry（可追加定义） */
export const registry = baseRegistry.clone();
/** 当前注册作用域（用于 .setVersionInfo("roguelike", {}) 标记 roguelike 专属定义） */
export const scope = registry.begin();
