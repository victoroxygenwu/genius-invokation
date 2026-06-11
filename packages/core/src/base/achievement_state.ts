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

/**
 * 成就追踪器状态接口
 * 
 * 定义成就追踪器的可序列化状态，支持确定性重放和checkpoint恢复。
 * 该状态将被纳入GameState中，作为游戏状态的一部分。
 */
export interface AchievementTrackerState {
  /** 已解锁的成就ID集合 */
  readonly unlockedAchievements: readonly number[];
  /** 累计获得的积分 */
  readonly totalScore: number;
  
  // ─── 行动级统计（每次行动后重置）──────────────────
  /** 行动内击倒数 */
  readonly actionDefeatCount: number;
  /** 单次技能最大伤害 */
  readonly skillMaxDamage: number;
  /** 单次技能最大治疗 */
  readonly skillMaxHeal: number;
  
  // ─── 回合级统计（每回合重置）──────────────────
  /** 回合击倒数 */
  readonly roundDefeatCount: number;
  /** 回合反应数 */
  readonly roundReactionCount: number;
  /** 本次投掷的骰子种类 */
  readonly diceTypes: readonly number[];
}

/**
 * 创建初始的成就追踪器状态
 */
export function createInitialAchievementTrackerState(): AchievementTrackerState {
  return {
    unlockedAchievements: [],
    totalScore: 0,
    actionDefeatCount: 0,
    skillMaxDamage: 0,
    skillMaxHeal: 0,
    roundDefeatCount: 0,
    roundReactionCount: 0,
    diceTypes: [],
  };
}
