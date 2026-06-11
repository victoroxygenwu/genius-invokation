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
import type {
  EventDefinition,
  EventConditionType,
  EventEffectType,
  RoguelikeRun,
} from "./types";
import { rollCards } from "./card-pool";
import { getCardName } from "./utils";

// ============================================================
// 条件评估
// ============================================================

/** 评估单个条件是否满足 */
function evaluateCondition(
  cond: EventConditionType,
  run: RoguelikeRun,
  data: GameData,
): boolean {
  switch (cond.type) {
    case "hasCard": {
      const count = run.deck.filter((id) => id === cond.cardId).length;
      return count >= (cond.minCount ?? 1);
    }
    case "hasCharacterTag": {
      const count = run.characters.filter((charId) => {
        const char = data.characters.get(charId);
        return char?.tags.some((t) => String(t) === cond.tag);
      }).length;
      return count >= (cond.minCount ?? 1);
    }
    case "hasCharacter":
      return run.characters.includes(cond.characterId);
    case "defeatedEnemy":
      // 检查已完成的遭遇中是否包含指定敌人
      return run.path.some(
        (node) =>
          node.completed &&
          node.encounters.some((enc) =>
            enc.configs.some((cfg) => cfg.characterId === cond.enemyId),
          ),
      );
    case "floorAtLeast":
      return run.floor >= cond.floor;
    case "currencyAtLeast":
      return run.currency >= cond.amount;
    case "deckSizeAtLeast":
      return run.deck.length >= cond.count;
    case "teamSizeAtLeast":
      return run.characters.length >= cond.count;
    case "anyEventCompleted":
      return cond.eventIds.some((id) => run.completedEventIds.includes(id));
    case "noEventCompleted":
      return !cond.eventIds.some((id) => run.completedEventIds.includes(id));
  }
}

/** 计算事件的总权重（所有条件都满足时累加权重，否则返回 0） */
export function evaluateEventWeight(
  event: EventDefinition,
  run: RoguelikeRun,
  data: GameData,
): number {
  if (event.conditions.length === 0) return 1;
  let totalWeight = 0;
  for (const cond of event.conditions) {
    if (!evaluateCondition(cond.condition, run, data)) {
      return 0;
    }
    totalWeight += cond.weight;
  }
  return Math.max(totalWeight, 1);
}

/** 获取所有满足条件的事件及其权重 */
export function getEligibleEvents(
  events: EventDefinition[],
  run: RoguelikeRun,
  data: GameData,
): { event: EventDefinition; weight: number }[] {
  return events
    .map((event) => ({ event, weight: evaluateEventWeight(event, run, data) }))
    .filter((e) => e.weight > 0);
}

// ============================================================
// 事件选择
// ============================================================

/** 从候选事件中按权重随机选择一个 */
export function selectEvent(
  eligible: { event: EventDefinition; weight: number }[],
): EventDefinition | null {
  if (eligible.length === 0) return null;
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) return entry.event;
  }
  return eligible[eligible.length - 1].event;
}

// ============================================================
// 模板渲染
// ============================================================

/** 替换模板中的 {{variable}} 变量 */
export function renderEventText(
  template: string,
  run: RoguelikeRun,
  data: GameData,
): string {
  return template.replace(/\{\{(\w+)(?::(\d+))?\}\}/g, (match, key, arg) => {
    switch (key) {
      case "playerNames":
        return run.characters
          .map((id) => getCardName(id))
          .join("、");
      case "deckSize":
        return String(run.deck.length);
      case "currency":
        return String(run.currency);
      case "floor":
        return String(run.floor);
      case "teamSize":
        return String(run.characters.length);
      case "cardName": {
        const cardId = Number(arg);
        return getCardName(cardId);
      }
      case "charName": {
        const charId = Number(arg);
        return getCardName(charId);
      }
      default:
        return match;
    }
  });
}

// ============================================================
// 效果应用
// ============================================================

/** 将事件效果应用到运行状态 */
export function applyEventEffects(
  effects: EventEffectType[],
  run: RoguelikeRun,
  data: GameData,
): void {
  for (const effect of effects) {
    applySingleEffect(effect, run, data);
  }
}

function applySingleEffect(
  effect: EventEffectType,
  run: RoguelikeRun,
  data: GameData,
): void {
  switch (effect.type) {
    case "addCurrency":
      run.currency += effect.amount;
      break;
    case "removeCurrency":
      run.currency = Math.max(0, run.currency - effect.amount);
      break;
    case "addCard": {
      const count = effect.count ?? 1;
      for (let i = 0; i < count; i++) {
        run.deck.push(effect.cardId);
      }
      break;
    }
    case "removeCard": {
      const count = effect.count ?? 1;
      let removed = 0;
      run.deck = run.deck.filter((id) => {
        if (id === effect.cardId && removed < count) {
          removed++;
          return false;
        }
        return true;
      });
      break;
    }
    case "addRandomCards": {
      const cards = rollCards(effect.count, {
        data,
        characterIds: run.characters,
        floor: run.floor,
        deck: run.deck,
      });
      for (const card of cards) {
        run.deck.push(card.cardId);
      }
      break;
    }
    case "modifyCharacterMaxHp": {
      // 注意：这里修改的是运行时角色的 maxHp 变量
      // 实际实现需要在战斗初始化时读取这个值
      // 目前通过在 run 上记录修正值来实现
      if (!run.characterHpModifiers) {
        run.characterHpModifiers = {};
      }
      if (effect.characterId) {
        const current = run.characterHpModifiers[effect.characterId] ?? 0;
        run.characterHpModifiers[effect.characterId] = current + effect.amount;
      } else {
        for (const charId of run.characters) {
          const current = run.characterHpModifiers[charId] ?? 0;
          run.characterHpModifiers[charId] = current + effect.amount;
        }
      }
      break;
    }
    case "healCharacter": {
      // 治疗效果需要在战斗中实现，这里记录到 modifiers
      // 正数 amount = 治疗
      if (!run.characterHpModifiers) {
        run.characterHpModifiers = {};
      }
      if (effect.characterId) {
        const current = run.characterHpModifiers[effect.characterId] ?? 0;
        run.characterHpModifiers[effect.characterId] = current + effect.amount;
      } else {
        for (const charId of run.characters) {
          const current = run.characterHpModifiers[charId] ?? 0;
          run.characterHpModifiers[charId] = current + effect.amount;
        }
      }
      break;
    }
    case "addCharacter":
      if (run.characters.length < 4 && !run.characters.includes(effect.characterId)) {
        run.characters = [...run.characters, effect.characterId];
      }
      break;
    case "modifyNextEnemyHp":
      run.nextEnemyHpModifier += effect.amount;
      break;
    case "skipNextNode":
      // 标记跳过下一个节点（在 confirmEvent 中处理）
      run.skipNextNode = true;
      break;
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 获取事件效果的简短描述（用于 UI 显示） */
export function getEffectDescription(effect: EventEffectType, data: GameData): string {
  switch (effect.type) {
    case "addCurrency":
      return `获得 ${effect.amount} 费用`;
    case "removeCurrency":
      return `失去 ${effect.amount} 费用`;
    case "addCard": {
      const name = getCardName(effect.cardId);
      return `获得 ${name}${(effect.count ?? 1) > 1 ? ` ×${effect.count}` : ""}`;
    }
    case "removeCard": {
      const name = getCardName(effect.cardId);
      return `移除 ${name}${(effect.count ?? 1) > 1 ? ` ×${effect.count}` : ""}`;
    }
    case "addRandomCards":
      return `获得 ${effect.count} 张随机卡牌`;
    case "modifyCharacterMaxHp":
      return `${effect.amount > 0 ? "+" : ""}${effect.amount} 角色生命上限`;
    case "healCharacter":
      return `恢复 ${effect.amount} 生命`;
    case "addCharacter": {
      return `获得角色：${getCardName(effect.characterId)}`;
    }
    case "modifyNextEnemyHp":
      return `下一个敌人 HP ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
    case "skipNextNode":
      return "跳过下一个节点";
  }
}

/** 获取条件的简短描述（用于编辑器显示） */
export function getConditionDescription(cond: EventConditionType, data: GameData): string {
  switch (cond.type) {
    case "hasCard": {
      const name = getCardName(cond.cardId);
      return `卡组中有 ${name}${(cond.minCount ?? 1) > 1 ? ` ×${cond.minCount}` : ""}`;
    }
    case "hasCharacterTag":
      return `队伍中有 ${cond.minCount ?? 1} 个 ${cond.tag} 角色`;
    case "hasCharacter": {
      return `队伍中有 ${getCardName(cond.characterId)}`;
    }
    case "defeatedEnemy": {
      return `已击败 ${getCardName(cond.enemyId)}`;
    }
    case "floorAtLeast":
      return `到达第 ${cond.floor} 层`;
    case "currencyAtLeast":
      return `费用 ≥ ${cond.amount}`;
    case "deckSizeAtLeast":
      return `卡组 ≥ ${cond.count} 张`;
    case "teamSizeAtLeast":
      return `队伍 ≥ ${cond.count} 人`;
    case "anyEventCompleted":
      return `已完成事件：${cond.eventIds.join(", ")}`;
    case "noEventCompleted":
      return `未完成事件：${cond.eventIds.join(", ")}`;
  }
}
