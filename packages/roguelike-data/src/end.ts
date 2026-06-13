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

import { resolveOfficialVersion, type Version } from "@gi-tcg/core";
import { registry, scope } from "./begin";

// 导入所有 roguelike 定义
import "./overrides";
import "./enemies";

scope.end();
registry.freeze();

export { registry };

/**
 * 获取 roguelike 模式的游戏数据。
 * 优先使用 roguelike 版本的定义，回退到官方版本。
 */
export default (version?: Version) => {
  return registry.resolve(
    (items) =>
      items.find((item) => item.version.from === "roguelike") ?? null,
    (items) => resolveOfficialVersion(items, version),
  );
};
