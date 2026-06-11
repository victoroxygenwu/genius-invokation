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
import { getCardName } from "./utils";

// ============================================================
// 动态卡牌列表查询
// ============================================================

export interface CardEntry { id: number; name: string }

/** 查询所有支援牌（按类型分组） */
export function querySupportCards(data: GameData): Record<string, CardEntry[]> {
  const groups: Record<string, CardEntry[]> = {};
  const supportTagLabels: Record<string, string> = {
    place: "场地", ally: "伙伴", item: "道具", blessing: "元素助佑", adventureSpot: "冒险地点",
  };
  for (const [id, def] of data.entities) {
    if (def.type !== "support") continue;
    const tag = def.tags.find((t) => t in supportTagLabels);
    const group = tag ? supportTagLabels[tag] : "其他";
    (groups[group] ??= []).push({ id, name: getCardName(id) });
  }
  return groups;
}

/** 按实体类型和标签查询卡牌 */
function queryCardsByTypeAndTag(data: GameData, type: string, tag: string): CardEntry[] {
  const cards: CardEntry[] = [];
  for (const [id, def] of data.entities) {
    if (def.type === type && (def.tags as string[]).includes(tag)) {
      cards.push({ id, name: getCardName(id) });
    }
  }
  return cards;
}

/** 查询所有食物卡 */
export const queryFoodCards = (data: GameData) => queryCardsByTypeAndTag(data, "eventCard", "food");

/** 查询所有圣遗物装备卡 */
export const queryArtifactCards = (data: GameData) => queryCardsByTypeAndTag(data, "equipment", "artifact");
