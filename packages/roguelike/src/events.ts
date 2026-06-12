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
import { getCardName, sample } from "./utils";
import { FALLBACK_EVENT_ID } from "./data";
import { CONDITION_DESCRIPTORS, EFFECT_DESCRIPTORS } from "./event-descriptors";

// ============================================================
// 共享常量
// ============================================================

/** 卡牌标签中文映射（用于效果描述和编辑器 UI） */
export const CARD_TAG_LABELS: Record<string, string> = {
  weapon: "武器", artifact: "圣遗物", place: "场地", ally: "伙伴",
  item: "道具", blessing: "元素助佑", food: "料理", talent: "天赋",
  eventCard: "事件牌", secret: "秘传",
};

// ============================================================
// 条件评估
// ============================================================

/**
 * 获取条件的匹配数量（用于权重缩放）。
 * 对于有计数意义的条件返回实际匹配数，否则返回 0 或 1。
 */
function getMatchCount(
  cond: EventConditionType,
  run: RoguelikeRun,
  data: GameData,
): number {
  switch (cond.type) {
    case "hasCard":
      return run.deck.filter((id) => id === cond.cardId).length;
    case "hasAnyCards":
      return cond.cardIds.some((cardId) => run.deck.includes(cardId)) ? 1 : 0;
    case "hasCharacterTag":
      return run.characters.filter((charId) => {
        const char = data.characters.get(charId);
        return char?.tags.some((t) => String(t) === cond.tag);
      }).length;
    case "hasCharacter":
      return run.characters.includes(cond.characterId) ? 1 : 0;
    case "hasAllCharacters":
      return cond.characterIds.every((id) => run.characters.includes(id)) ? 1 : 0;
    case "noCharacter":
      return !run.characters.includes(cond.characterId) ? 1 : 0;
    case "defeatedEnemy":
      return run.path.some(
        (node) =>
          node.completed &&
          node.encounters.some((enc) =>
            enc.configs.some((cfg) => cfg.characterId === cond.enemyId),
          ),
      ) ? 1 : 0;
    case "floorAtLeast":
      return run.floor >= cond.floor ? 1 : 0;
    case "currencyAtLeast":
      return run.currency >= cond.amount ? 1 : 0;
    case "deckSizeAtLeast":
      return run.deck.length >= cond.count ? 1 : 0;
    case "teamSizeAtLeast":
      return run.characters.length >= cond.count ? 1 : 0;
    case "teamSizeAtMost":
      return run.characters.length <= cond.count ? 1 : 0;
    case "teamOnlyElements": {
      if (run.characters.length === 0) return 0;
      const allMatch = run.characters.every((charId) => {
        const char = data.characters.get(charId);
        return char?.tags.some((t) => cond.elements.includes(String(t)));
      });
      return allMatch ? 1 : 0;
    }
    case "anyEventCompleted":
      return cond.eventIds.some((id) => run.completedEventIds.includes(id)) ? 1 : 0;
    case "noEventCompleted":
      return !cond.eventIds.some((id) => run.completedEventIds.includes(id)) ? 1 : 0;
  }
}

/**
 * 计算事件的总权重。
 *
 * 算法：根据 conditionMode 决定 AND/OR 逻辑 + 匹配数量缩放
 * - "or"（默认）：任意条件满足即为候选，满足的条件权重累加
 * - "and"：所有条件必须满足才为候选
 * - 使用 log2(matchCount + 1) 作为缩放因子，提供递减收益
 */
export function evaluateEventWeight(
  event: EventDefinition,
  run: RoguelikeRun,
  data: GameData,
): number {
  if (event.conditions.length === 0) return 1;

  const mode = event.conditionMode ?? "or";
  let totalWeight = 0;
  let anyMet = false;

  for (const cond of event.conditions) {
    const count = getMatchCount(cond.condition, run, data);
    const threshold = ("minCount" in cond.condition && cond.condition.minCount)
      ? cond.condition.minCount : 1;
    if (count >= threshold) {
      anyMet = true;
      const scale = Math.max(1, Math.log2(count + 1));
      totalWeight += cond.weight * scale;
    } else if (mode === "and") {
      // AND 模式：任一不满足 → 事件不可用
      return 0;
    }
  }

  return anyMet ? Math.max(totalWeight, 1) : 0;
}

/** 获取所有满足条件且未完成的事件及其权重（排除回退事件） */
export function getEligibleEvents(
  events: EventDefinition[],
  run: RoguelikeRun,
  data: GameData,
): { event: EventDefinition; weight: number }[] {
  const completed = new Set(run.completedEventIds);
  return events
    .filter((event) => event.id !== FALLBACK_EVENT_ID && !completed.has(event.id))
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
    case "addCharacter":
      if (run.characters.length < 4 && !run.characters.includes(effect.characterId)) {
        run.characters = [...run.characters, effect.characterId];
      }
      break;
    case "modifyNextBattleAllyHp":
      run.nextBattleAllyHpModifier += effect.amount;
      break;
    case "modifyNextBattleEnemyHp":
      run.nextBattleEnemyHpModifier += effect.amount;
      break;
    case "skipNextNormalBattle":
      run.skipNextNormalBattle = true;
      break;
    case "chooseAndRemoveCard":
      // 标记需要选择删除卡牌（在 UI 层处理）
      run.pendingChooseAndRemoveCard = true;
      break;
    case "randomCard": {
      // 从 GameData 中按标签筛选卡牌，随机选取
      const count = effect.count ?? 1;
      const candidates: number[] = [];
      for (const [id, def] of data.entities) {
        if (def.type === "status" || def.type === "combatStatus" || def.type === "summon") continue;
        const tags = def.tags as string[] | undefined;
        if (!tags?.includes(effect.tag)) continue;
        candidates.push(id);
      }
      if (candidates.length > 0) {
        const picked = sample(candidates, count);
        for (const cardId of picked) {
          run.deck.push(cardId);
        }
      }
      break;
    }
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 获取事件效果的简短描述（用于 UI 显示） */
export function getEffectDescription(effect: EventEffectType, _data: GameData): string {
  const desc = EFFECT_DESCRIPTORS[effect.type];
  return desc?.describe(effect) ?? `[${effect.type}]`;
}

/** 获取条件的简短描述（用于编辑器显示） */
export function getConditionDescription(cond: EventConditionType, _data: GameData): string {
  const desc = CONDITION_DESCRIPTORS[cond.type];
  return desc?.describe(cond) ?? `[${cond.type}]`;
}
