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

import type { PlayerIO, GameData } from "@gi-tcg/core";
import { dispatchRpc, ActionValidity, type Action } from "@gi-tcg/typings";

type SkillType = "normal" | "elemental" | "burst";

function getSkillId(action: Action): number | undefined {
  if (action.action?.$case === "useSkill") {
    return action.action.value.skillDefinitionId;
  }
  return undefined;
}

function buildSkillTypeMap(data: GameData): Map<number, SkillType> {
  const map = new Map<number, SkillType>();
  for (const [, charDef] of data.characters) {
    for (const skill of charDef.skills ?? []) {
      const st = skill.skillType;
      if (st === "normal" || st === "elemental" || st === "burst") {
        map.set(skill.id, st);
      }
    }
  }
  return map;
}

/**
 * 创建简化 AI PlayerIO。
 *
 * 优先级：元素爆发 > 元素战技（轮流使用） > 普通攻击 > 出牌 > 结束回合
 * 技能类型通过 GameData 的 skillDefinition 确定，而非 ID 尾数。
 * AI 使用 alwaysOmni 配置，骰子由引擎自动选择。
 */
export function createSimpleAI(data: GameData): PlayerIO {
  const skillTypeMap = buildSkillTypeMap(data);
  let lastElementalSkillId: number | null = null;

  return {
    notify: () => {},
    rpc: dispatchRpc({
      chooseActive: async (req) => ({
        activeCharacterId: req.candidateIds[0],
      }),
      rerollDice: async () => ({ diceToReroll: [] }),
      switchHands: async () => ({ removedHandIds: [] }),
      selectCard: async (req) => ({
        selectedDefinitionId: req.candidateDefinitionIds[0],
      }),
      action: async (req) => {
        if (!req.action?.length) {
          return { chosenActionIndex: 0, usedDice: [] };
        }

        // 单次遍历分类所有有效行动
        const burstIndices: number[] = [];
        const elementalIndices: number[] = [];
        const normalIndices: number[] = [];
        let cardIdx = -1;
        let endIdx = -1;

        for (let i = 0; i < req.action.length; i++) {
          const a = req.action[i];
          if (a.action?.$case === "declareEnd") { endIdx = i; continue; }
          if (a.validity !== ActionValidity.VALID) continue;
          if (a.action?.$case === "playCard") { if (cardIdx < 0) cardIdx = i; continue; }
          const sid = getSkillId(a);
          const st = sid != null ? skillTypeMap.get(sid) : undefined;
          if (st === "burst") burstIndices.push(i);
          else if (st === "elemental") elementalIndices.push(i);
          else if (st === "normal") normalIndices.push(i);
        }

        // 1. 元素爆发（最高优先级）
        if (burstIndices.length > 0) {
          const idx = burstIndices[0];
          return { chosenActionIndex: idx, usedDice: req.action[idx].autoSelectedDice };
        }

        // 2. 元素战技（多个战技时轮流使用）
        if (elementalIndices.length > 0) {
          for (const idx of elementalIndices) {
            const sid = getSkillId(req.action[idx]);
            if (sid !== lastElementalSkillId) {
              lastElementalSkillId = sid ?? null;
              return { chosenActionIndex: idx, usedDice: req.action[idx].autoSelectedDice };
            }
          }
          const idx = elementalIndices[0];
          lastElementalSkillId = getSkillId(req.action[idx]) ?? null;
          return { chosenActionIndex: idx, usedDice: req.action[idx].autoSelectedDice };
        }

        // 3. 普通攻击
        if (normalIndices.length > 0) {
          const idx = normalIndices[0];
          return { chosenActionIndex: idx, usedDice: req.action[idx].autoSelectedDice };
        }

        // 4. 出牌
        if (cardIdx >= 0) {
          return { chosenActionIndex: cardIdx, usedDice: req.action[cardIdx].autoSelectedDice };
        }

        // 5. 结束回合
        return { chosenActionIndex: endIdx >= 0 ? endIdx : 0, usedDice: [] };
      },
    }),
  };
}
