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

import {
  WEAPON_CARD_MAP,
  DEFAULT_WEAPON_CARD,
  ARTIFACT_CARD_MAP,
  BEST_PARTNER,
  MONDSTADT_HASH_BROWN,
} from "./data";

// ============================================================
// 初始卡组生成
// ============================================================

/** 根据角色标签生成对应卡牌 */
function cardsForCharacter(tags: string[]): number[] {
  const cards: number[] = [];
  const weaponTag = tags.find((t) => WEAPON_CARD_MAP[t] !== undefined);
  cards.push(weaponTag ? WEAPON_CARD_MAP[weaponTag] : DEFAULT_WEAPON_CARD);
  const elementTag = tags.find((t) => ARTIFACT_CARD_MAP[t] !== undefined);
  if (elementTag) cards.push(ARTIFACT_CARD_MAP[elementTag]);
  return cards;
}

/** 根据角色标签列表生成初始卡组 */
export function generateInitialDeck(characterTagsList: string[][]): number[] {
  const deck = characterTagsList.flatMap(cardsForCharacter);
  deck.push(BEST_PARTNER, BEST_PARTNER, MONDSTADT_HASH_BROWN, MONDSTADT_HASH_BROWN);
  return deck;
}

/** 追加角色时生成对应卡牌 */
export function generateCharacterCards(tags: string[]): number[] {
  return cardsForCharacter(tags);
}
