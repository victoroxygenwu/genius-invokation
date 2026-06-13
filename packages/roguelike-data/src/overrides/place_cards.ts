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

import { card, combatStatus, DiceType } from "@gi-tcg/core/builder";
import { flip } from "@gi-tcg/utils";

// 禁忌知识卡牌 ID
const FORBIDDEN_KNOWLEDGE_CARD_ID = 301020 as any;

// ============================================================
// 赤王陵（Roguelike 强化版）
// ============================================================

/**
 * @id 301022
 * @name 赤王陵·禁忌蔓延（生效中）
 * @description
 * 持续2回合。每回合结束阶段：在对方牌库顶生成2张禁忌知识。
 */
const TheMausoleumOfKingDeshretRoguelikeInEffect = combatStatus(301022)
  .setVersionInfo("roguelike", {})
  .duration(2)
  .on("endPhase")
  .do((c) => {
    c.createPileCards(FORBIDDEN_KNOWLEDGE_CARD_ID, 2, "top", "opp");
  })
  .done();

/**
 * @id 321020
 * @name 赤王陵（Roguelike 强化版）
 * @description
 * Roguelike 模式专属效果：
 * 打出后，每回合为对方牌库顶生成2张禁忌知识，持续2回合。
 */
export const TheMausoleumOfKingDeshretRoguelike = card(321020)
  .setVersionInfo("roguelike", {})
  .costSame(1)
  .support("place")
  .on("enter")
  .do((c) => {
    c.combatStatus(TheMausoleumOfKingDeshretRoguelikeInEffect);
  })
  .done();

// ============================================================
// 以极限之名（Roguelike 强化版）
// ============================================================

/**
 * @id 332044
 * @name 以极限之名（Roguelike 强化版）
 * @description
 * Roguelike 模式专属效果：
 * 消耗3个元素骰，重新随机敌方的所有元素骰。
 */
export const InTheNameOfTheExtremeRoguelike = card(332044)
  .setVersionInfo("roguelike", {})
  .costSame(3)
  .do((c) => {
    // 获取对方当前骰子数量
    const oppWho = flip(c.self.who);
    const oppDiceCount = c.oppPlayer.dice.length;
    // 生成新的随机骰子
    const diceTypes = [
      DiceType.Anemo,
      DiceType.Cryo,
      DiceType.Dendro,
      DiceType.Electro,
      DiceType.Geo,
      DiceType.Hydro,
      DiceType.Pyro,
      DiceType.Omni,
    ];
    const newDice: DiceType[] = [];
    for (let i = 0; i < oppDiceCount; i++) {
      newDice.push(c.random(diceTypes));
    }
    // 重置对方骰子
    c.mutate({
      type: "resetDice",
      who: oppWho,
      value: newDice,
      reason: "roll",
    });
  })
  .done();
