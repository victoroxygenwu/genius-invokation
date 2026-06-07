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

import type { GameState } from "./base/state";
import type { ActionInfo } from "./base/skill";

/**
 * 成就检查函数
 * @param state 当前游戏状态
 * @param action 当前行动信息（行动后检查时传入，游戏结束时为 null）
 * @param tracker 成就追踪器实例，可读取统计数据
 * @returns 是否满足成就条件
 */
export type AchievementCheckFn = (
  state: GameState,
  action: ActionInfo | null,
  tracker: AchievementTracker,
) => boolean;

/**
 * 成就定义
 */
export interface AchievementDefinition {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly score: number;
  /** 是否可重复解锁（默认 false，解锁一次后不再检查） */
  readonly repeatable: boolean;
  /** 是否启用（默认 true，设为 false 时跳过检查） */
  readonly enabled: boolean;
  readonly check: AchievementCheckFn;
}

/**
 * 成就持久化接口
 *
 * 实现此接口以跨游戏会话保存已解锁的成就。
 * Web 环境可使用 localStorage，其他环境可自定义实现。
 */
export interface AchievementPersistence {
  /** 加载已解锁的成就 ID 列表 */
  load(): readonly number[] | Promise<readonly number[]>;
  /** 保存已解锁的成就 ID 列表 */
  save(ids: readonly number[]): void | Promise<void>;
}

// ─── Builder DSL ────────────────────────────────────────────────

/**
 * 成就 Builder，链式定义成就属性
 *
 * @example
 * ```ts
 * export const ACH_1001 = achievement(1001)
 *   .name("骰子大师")
 *   .description("一次投掷中掷出8种不同元素的骰子")
 *   .score(5)
 *   .icon("🎲")
 *   .check((_state, _action, tracker) => tracker.diceTypes.size >= 8)
 *   .done();
 * ```
 */
export class AchievementBuilder {
  private _id: number;
  private _name = "";
  private _description = "";
  private _icon?: string;
  private _score = 1;
  private _repeatable = false;
  private _enabled = true;
  private _check?: AchievementCheckFn;

  constructor(id: number) {
    this._id = id;
  }

  name(n: string): this {
    this._name = n;
    return this;
  }

  description(d: string): this {
    this._description = d;
    return this;
  }

  icon(i: string): this {
    this._icon = i;
    return this;
  }

  /** 设置成就积分（1-10） */
  score(s: number): this {
    this._score = s;
    return this;
  }

  /** 设为可重复解锁（默认只解锁一次） */
  repeatable(r = true): this {
    this._repeatable = r;
    return this;
  }

  /** 设为禁用（跳过检查） */
  enabled(e = true): this {
    this._enabled = e;
    return this;
  }

  /**
   * 设置成就检查函数
   *
   * 函数接收当前游戏状态、行动信息和追踪器实例。
   * 返回 true 表示成就条件满足，应被解锁。
   */
  check(fn: AchievementCheckFn): this {
    this._check = fn;
    return this;
  }

  done(): AchievementDefinition {
    if (!this._check) {
      throw new Error(`Achievement ${this._id}: check function is required`);
    }
    return Object.freeze({
      id: this._id,
      name: this._name,
      description: this._description,
      icon: this._icon,
      score: this._score,
      repeatable: this._repeatable,
      enabled: this._enabled,
      check: this._check,
    });
  }
}

/**
 * 创建成就定义的入口函数
 *
 * @example
 * ```ts
 * export const MyAchievement = achievement(1001)
 *   .name("成就名称")
 *   .description("成就描述")
 *   .score(5)
 *   .icon("🏆")
 *   .check((state, action, tracker) => { ... })
 *   .done();
 * ```
 */
export function achievement(id: number): AchievementBuilder {
  return new AchievementBuilder(id);
}

// ─── Achievement Tracker ────────────────────────────────────────

/**
 * 成就追踪器
 *
 * 跟踪游戏中的统计数据，供成就检查函数使用。
 * Game 类在关键时刻调用 record* 方法更新统计，
 * 并在行动后和游戏结束时调用 checkAchievements 评估成就。
 */
export class AchievementTracker {
  private unlockedAchievements = new Set<number>();
  private _totalScore = 0;
  private persistence?: AchievementPersistence;

  /** 行动内击倒数（每次行动后重置） */
  actionDefeatCount = 0;

  /** 回合击倒数（每回合重置） */
  roundDefeatCount = 0;

  /** 回合反应数（每回合重置） */
  roundReactionCount = 0;

  /** 单次技能最大伤害（每次行动后重置） */
  skillMaxDamage = 0;

  /** 单次技能最大治疗（每次行动后重置） */
  skillMaxHeal = 0;

  /** 本次投掷的骰子种类（每回合重置） */
  diceTypes = new Set<number>();

  /** 累计获得的积分 */
  get totalScore(): number {
    return this._totalScore;
  }

  // ─── 预计算的成就统计（用于快速跳过检查）──────────────────
  private _nonRepeatableCount = 0;
  private _hasRepeatable = false;

  /** 设置成就定义后调用，预计算统计数据 */
  prepareDefinitions(definitions: readonly AchievementDefinition[]): void {
    this._nonRepeatableCount = definitions.filter(a => !a.repeatable).length;
    this._hasRepeatable = definitions.some(a => a.repeatable);
  }

  // ─── 持久化方法 ──────────────────────────────────────────────

  /**
   * 设置持久化提供者
   */
  setPersistence(persistence: AchievementPersistence): void {
    this.persistence = persistence;
  }

  /**
   * 从持久化存储加载已解锁的成就
   *
   * 加载的成就会被标记为已解锁，但不会计入 totalScore（避免重复计算）。
   */
  async loadPersistedAchievements(): Promise<void> {
    if (!this.persistence) return;
    try {
      const ids = await this.persistence.load();
      for (const id of ids) {
        this.unlockedAchievements.add(id);
      }
    } catch (e) {
      console.warn("Failed to load persisted achievements:", e);
    }
  }

  /**
   * 将当前已解锁的成就保存到持久化存储
   */
  async saveAchievements(): Promise<void> {
    if (!this.persistence) return;
    try {
      await this.persistence.save(Array.from(this.unlockedAchievements));
    } catch (e) {
      console.warn("Failed to save achievements:", e);
    }
  }

  // ─── 记录方法 ──────────────────────────────────────────────

  recordDamage(damage: number, isDefeat: boolean): void {
    this.skillMaxDamage = Math.max(this.skillMaxDamage, damage);
    if (isDefeat) {
      this.actionDefeatCount++;
      this.roundDefeatCount++;
    }
  }

  recordHeal(heal: number): void {
    this.skillMaxHeal = Math.max(this.skillMaxHeal, heal);
  }

  recordReaction(): void {
    this.roundReactionCount++;
  }

  recordDiceRoll(dice: readonly number[]): void {
    for (const die of dice) {
      this.diceTypes.add(die);
    }
  }

  // ─── 重置方法 ──────────────────────────────────────────────

  resetActionStats(): void {
    this.actionDefeatCount = 0;
    this.skillMaxDamage = 0;
    this.skillMaxHeal = 0;
  }

  resetRoundStats(): void {
    this.roundDefeatCount = 0;
    this.roundReactionCount = 0;
  }

  resetDiceStats(): void {
    this.diceTypes.clear();
  }

  // ─── 评估方法 ──────────────────────────────────────────────

  /**
   * 检查所有成就，返回新解锁的成就列表
   *
   * @param achievements 所有成就定义
   * @param state 当前游戏状态
   * @param action 当前行动信息（行动后传入，游戏结束时传 null）
   * @returns 新解锁的成就 { id, score } 列表
   */
  checkAchievements(
    achievements: readonly AchievementDefinition[],
    state: GameState,
    action: ActionInfo | null,
  ): AchievementDefinition[] {
    if (!this._hasRepeatable && this.unlockedAchievements.size >= this._nonRepeatableCount) {
      return [];
    }
    const newlyUnlocked: AchievementDefinition[] = [];

    for (const ach of achievements) {
      if (!ach.enabled) continue;
      if (!ach.repeatable && this.unlockedAchievements.has(ach.id)) continue;
      try {
        if (ach.check(state, action, this)) {
          this.unlockedAchievements.add(ach.id);
          this._totalScore += ach.score;
          newlyUnlocked.push(ach);
        }
      } catch (e) {
        console.warn(`Achievement check failed for "${ach.name}" (id=${ach.id}):`, e);
      }
    }

    return newlyUnlocked;
  }

  /**
   * 获取已解锁的成就 ID 列表
   */
  getUnlockedAchievements(): number[] {
    return Array.from(this.unlockedAchievements);
  }
}
