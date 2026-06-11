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

import { achievement } from "@gi-tcg/core/builder";
import type { GameState } from "@gi-tcg/core";

// ─── 角色 ID ────────────────────────────────────────────────
const ZHONGLI = 1301;
const RUOTUO_LONGWANG = 1401;  // 若陀龙王

/**
 * 画龙点睛：卡组中同时包含角色牌"钟离"、"若陀龙王"并取得胜利
 */
export const ACH_2002 = achievement(2002)
  .name("画龙点睛")
  .description("卡组中同时包含角色牌「钟离」、「若陀龙王」并取得胜利")
  .score(8)
  .icon("🐉")
  .check((state) => {
    if (state.winner === null) return false;
    // 检查胜利方的角色列表
    const charIds = state.players[state.winner].characters.map((c) => c.definition.id);
    return charIds.includes(ZHONGLI) && charIds.includes(RUOTUO_LONGWANG);
  })
  .done();
