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

// ─── 装备 ID ────────────────────────────────────────────────
const QIANYAN_LAOGU = 331301;   // 千岩牢固
const GUANHONG_ZHISHA = 332301;  // 贯虹之槊
const CHUIJIN_ZHUANYU = 333301;  // 炊金馔玉

/**
 * 检查指定角色是否同时装备了所有指定装备
 */
function hasAllEquipment(
  state: GameState,
  who: 0 | 1,
  characterId: number,
  equipmentIds: number[],
): boolean {
  const character = state.players[who].characters.find(
    (c) => c.definition.id === characterId,
  );
  if (!character) return false;
  const equippedIds = character.entities
    .filter((e) => e.definition.type === "equipment")
    .map((e) => e.definition.id);
  return equipmentIds.every((id) => equippedIds.includes(id));
}

/**
 * 尘世闲游：角色牌"钟离"同时装备千岩牢固、贯虹之槊、炊金馔玉
 */
export const ACH_2001 = achievement(2001)
  .name("尘世闲游")
  .description("角色牌「钟离」同时装备千岩牢固、贯虹之槊、炊金馔玉")
  .score(10)
  .icon("🌍")
  .check((state) =>
    hasAllEquipment(state, 0, ZHONGLI, [QIANYAN_LAOGU, GUANHONG_ZHISHA, CHUIJIN_ZHUANYU]) ||
    hasAllEquipment(state, 1, ZHONGLI, [QIANYAN_LAOGU, GUANHONG_ZHISHA, CHUIJIN_ZHUANYU]),
  )
  .done();
