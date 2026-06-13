/**
 * 敌人 AI
 *
 * 优先级：
 *   1. 被控制 → 切人
 *   2. switchAfterSkill → 切人（放完技能后的强制切人）
 *   3. 有可打的牌 → 打牌
 *   4. 有可用技能 → 用最佳技能（爆发 > 元素战技 > 普攻）
 *   5. 骰子不够且没切过 → 切人
 *   6. 结束回合
 */

import type { PlayerIO, GameData } from "@gi-tcg/core";
import { dispatchRpc, ActionValidity, type Action, type Notification } from "@gi-tcg/typings";

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
 * 创建敌人 AI（简单优先级策略）。
 *
 * 行动优先级（高→低）：
 * 1. 被控制（无可用技能）→ 强制切人
 * 2. switchAfterSkill 阶段 → 切人（放完技能后轮转到下一个角色）
 * 3. 打出手牌（优先使用事件牌/装备牌）
 * 4. 使用技能：元素爆发 > 元素战技 > 普通攻击
 * 5. 未切过人 → 切人（轮转到下一个角色）
 * 6. 结束回合
 *
 * 切人状态机（防止无限切人循环）：
 *   normal ──(使用技能后)──→ switchAfterSkill ──(切人后)──→ justSwitched
 *     ↑                                                        │
 *     └──────────(下一轮回合开始时重置)──────────────────────────┘
 *
 * 切人策略：按角色 ID 排序后的轮转（round-robin），
 * 从当前活跃角色的下一个开始尝试，跳过已倒下的角色。
 */
export function createSimpleAI(data: GameData): PlayerIO {
  const skillTypeMap = buildSkillTypeMap(data);

  // 切人状态机：normal → switchAfterSkill（放完技能后强制切人） → justSwitched（切过人，不再切）
  type SwitchPhase = "normal" | "switchAfterSkill" | "justSwitched";
  let phase: SwitchPhase = "normal";
  let activeCharacterId = -1;

  return {
    notify: (notification: Notification) => {
      const chId = notification.state?.player?.[1]?.activeCharacterId;
      if (typeof chId === "number") {
        activeCharacterId = chId;
      }
    },
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

        const actions = req.action;
        const playCards: number[] = [];
        const burstSkills: number[] = [];
        const elementalSkills: number[] = [];
        const normalSkills: number[] = [];
        const switchTargets: number[] = [];
        let declareEndIdx = -1;
        let hasAnySkill = false;
        let hasValidSkill = false;

        for (let i = 0; i < actions.length; i++) {
          const a = actions[i];
          switch (a.action?.$case) {
            case "declareEnd":
              declareEndIdx = i;
              break;
            case "switchActive":
              if (a.validity === ActionValidity.VALID) switchTargets.push(i);
              break;
            case "useSkill":
              hasAnySkill = true;
              if (a.validity === ActionValidity.VALID) {
                hasValidSkill = true;
                const sid = getSkillId(a);
                const st = sid != null ? skillTypeMap.get(sid) : undefined;
                if (st === "burst") burstSkills.push(i);
                else if (st === "elemental") elementalSkills.push(i);
                else normalSkills.push(i);
              }
              break;
            case "playCard":
              if (a.validity === ActionValidity.VALID) playCards.push(i);
              break;
          }
        }

        const isControlled = hasAnySkill && !hasValidSkill;

        const doSwitch = () => {
          if (switchTargets.length === 0) return null;
          const sorted = switchTargets
            .map(i => ({
              idx: i,
              charId: (actions[i].action as { $case: "switchActive"; value: { characterId: number } }).value.characterId,
            }))
            .sort((a, b) => a.charId - b.charId); // 升序：小的在前
          // activeCharacterId 是当前活跃角色（不在 targets 中）
          // 它在排序列表中的下一个就是轮转目标
          // 用插入点：找最后一个 < activeCharacterId 的位置，下一个就是目标
          let curIdx = -1;
          for (let j = 0; j < sorted.length; j++) {
            if (sorted[j].charId < activeCharacterId) {
              curIdx = j;
            }
          }
          const picked = sorted[(curIdx + 1) % sorted.length];
          phase = "justSwitched";
          return { chosenActionIndex: picked.idx, usedDice: actions[picked.idx].autoSelectedDice };
        };

        if (isControlled) {
          const result = doSwitch();
          if (result) return result;
          if (declareEndIdx >= 0) return { chosenActionIndex: declareEndIdx, usedDice: [] };
          return { chosenActionIndex: 0, usedDice: [] };
        }
        if (phase === "switchAfterSkill") {
          const result = doSwitch();
          if (result) return result;
          phase = "normal";
        }
        if (playCards.length > 0) {
          const idx = playCards[0];
          return { chosenActionIndex: idx, usedDice: actions[idx].autoSelectedDice };
        }
        const chosenSkills = [burstSkills, elementalSkills, normalSkills].find(a => a.length > 0);
        if (chosenSkills) {
          phase = "switchAfterSkill";
          const idx = chosenSkills[0];
          return { chosenActionIndex: idx, usedDice: actions[idx].autoSelectedDice };
        }
        if (phase !== "justSwitched") {
          const result = doSwitch();
          if (result) return result;
        }
        if (declareEndIdx >= 0) {
          return { chosenActionIndex: declareEndIdx, usedDice: [] };
        }
        return { chosenActionIndex: 0, usedDice: [] };
      },
    }),
  };
}
