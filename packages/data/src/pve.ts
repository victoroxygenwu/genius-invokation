/**
 * PvE 专用状态定义。
 * 这些状态仅在 roguelike PvE 模式中使用，不影响正常对战。
 */

import { status } from "@gi-tcg/core/builder";

/**
 * @id 9000001
 * @name PvE 满血复活
 * @description
 * 所附属角色被击倒时：消耗 1 次可用次数，使角色免于被击倒，并治疗该角色到最大生命值。
 * 可用次数可叠加，用尽后移除。
 */
export const PvEFullRevive = status(9000001)
  .on("beforeDefeated")
  .usageCanAppend(1, Infinity)
  .immune(9999)
  .consumeUsage(1)
  .done();
