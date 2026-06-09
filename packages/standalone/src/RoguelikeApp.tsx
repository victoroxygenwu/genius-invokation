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

import { PvEMode } from "./PvEMode";

/**
 * 独立的 Roguelike PvE 入口。
 * 可以单独打包为可执行程序，不包含 PvP 功能。
 */
export function RoguelikeApp() {
  return (
    <div class="roguelike-app">
      <header class="roguelike-header">
        <h1>七圣召唤 · Roguelike</h1>
      </header>
      <PvEMode onBack={() => window.location.reload()} />
    </div>
  );
}
