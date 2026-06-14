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

import type { RoguelikeConfig } from "./types";
import { DEFAULT_EVENTS } from "./default-events";

/**
 * 默认 roguelike 配置
 * - 3 层，每层 5-6 个节点
 * - 初始货币 0，商店 10 张卡，奖励 5 张卡
 * - 利息上限 50，每 10 货币 1 利息
 */
export const ROGUELIKE_CONFIG: RoguelikeConfig = {
  floors: [
    { floor: 1, path: ["event", "normal", "event", "elite", "shop", "boss"], fixedEventIds: [2001] },
    { floor: 2, path: ["normal", "event", "elite", "shop", "boss"] },
    { floor: 3, path: ["normal", "event", "elite", "shop", "boss"] },
  ],
  initialCurrency: 0,
  shopCardCount: 10,
  rewardCardCount: 5,
  interestThreshold: 50,
  interestRate: 10,
  events: DEFAULT_EVENTS,
};
