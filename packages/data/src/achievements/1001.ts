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
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { achievement } from "@gi-tcg/core/builder";

/**
 * 唐骰：一次投掷中掷出8种不同元素的骰子
 */
export const ACH_1001 = achievement(1001)
  .name("唐骰")
  .description("一次投掷中掷出8种不同元素的骰子")
  .score(5)
  .icon("🎲")
  .repeatable()
  .check((_state, _action, tracker) => tracker.diceTypes.size >= 8)
  .done();
