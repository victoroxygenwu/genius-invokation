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
import type { GameState, ActionInfo } from "@gi-tcg/core";

// ─── 角色 ID ────────────────────────────────────────────────
const KEQING = 1201;  // 刻晴

/**
 * 检查当前行动是否由指定角色执行
 */
function isActionByCharacter(
  state: GameState,
  action: ActionInfo | null,
  characterId: number,
): boolean {
  if (!action || action.type !== "useSkill") return false;
  const who = action.who;
  const activeChar = state.players[who].characters.find(
    (c) => c.id === state.players[who].activeCharacterId,
  );
  return activeChar?.definition.id === characterId;
}

/**
 * 斩尽芜杂：使用角色牌"刻晴"在一次战斗行动内击倒对方3个角色
 */
export const ACH_3001 = achievement(3001)
  .name("斩尽芜杂")
  .description("使用角色牌「刻晴」在一次战斗行动内击倒对方3个角色")
  .score(10)
  .icon("⚔️")
  .check((state, action, tracker) => {
    if (!isActionByCharacter(state, action, KEQING)) return false;
    return tracker.actionDefeatCount >= 3;
  })
  .done();
