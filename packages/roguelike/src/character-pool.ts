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

import type { GameData } from "@gi-tcg/core";
import type { CharacterPoolEntry } from "./types";
import { getCardName, sample } from "./utils";
import { ALL_ELEMENTS, WEAPON_TAGS } from "./data";

// ============================================================
// 角色池
// ============================================================

/** 从 GameData 动态生成可选角色池（排除怪物角色 2xxx+） */
export function generateCharacterPool(data: GameData): CharacterPoolEntry[] {
  const pool: CharacterPoolEntry[] = [];
  for (const [id, def] of data.characters) {
    if (id >= 2000) continue; // 排除怪物
    const tags = def.tags.map(String);
    const element = ALL_ELEMENTS.find((e) => tags.includes(e)) ?? "";
    const weapon = tags.find((t) => WEAPON_TAGS.has(t)) ?? "";
    pool.push({ id, name: getCardName(id), element, weapon });
  }
  return pool;
}

export function rollCharacterChoices(count: number, data: GameData, excludeIds: number[] = [], cachedPool?: CharacterPoolEntry[]): CharacterPoolEntry[] {
  const pool = cachedPool ?? generateCharacterPool(data);
  const excluded = new Set(excludeIds);
  const available = pool.filter((c) => !excluded.has(c.id));
  return sample(available, count);
}
