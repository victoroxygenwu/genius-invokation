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

import { extension, status } from "@gi-tcg/core/builder";

/** 安全获取 Boss 阶段信息，who 越界时返回 null */
function getPhaseInfo(c: any): { who: number; phase: number; maxPhase: number } | null {
  const who = c.self.who;
  if (who !== 0 && who !== 1) return null;
  const st = c.getExtensionState();
  return { who, phase: st.phase[who], maxPhase: st.maxPhase };
}

/**
 * 创建 Boss 多段生命 Extension。
 *
 * 使用 `pair<number>` 追踪两个玩家各自的 Boss 当前阶段。
 */
export function createBossPhaseExtension(
  bossCharId: number,
  maxPhase: number = 3,
) {
  return extension(90000 + bossCharId, {
    phase: "pair<number>",
    maxPhase: "number",
  })
    .initialState({ phase: [1, 1], maxPhase })
    .description("Boss 多段生命")
    .done();
}

/**
 * 创建 Boss 多段生命 Status。
 *
 * 机制：
 * - Boss 有 maxPhase 段生命
 * - 每段生命被击杀后，Boss 复活回满血，进入下一阶段
 * - 阶段 2&3：受到伤害 -1
 * - 阶段 3：造成伤害 +1
 */
export function createBossPhaseStatus(
  bossCharId: number,
  extensionHandle: ReturnType<typeof createBossPhaseExtension>,
) {
  return status(91000 + bossCharId)
    .associateExtension(extensionHandle)
    // 多段生命：击杀时复活回满血
    .on("beforeDefeated", (c: any) => {
      const info = getPhaseInfo(c);
      return info ? info.phase < info.maxPhase : false;
    })
    .do((c: any) => {
      const info = getPhaseInfo(c);
      if (!info) return;
      const st = c.getExtensionState();
      st.phase[info.who] = info.phase + 1;
    })
    .immune(99) // 复活到 99 血（实际会被 heal 到 maxHealth）
    .endOn()
    // 阶段 2&3：受到伤害 -1
    .on("decreaseDamaged", (c: any) => {
      const info = getPhaseInfo(c);
      return info ? info.phase >= 2 : false;
    })
    .do((c: any, e: any) => {
      e.decreaseDamage(1);
    })
    .endOn()
    // 阶段 3：造成伤害 +1
    .on("increaseDamage", (c: any) => {
      const info = getPhaseInfo(c);
      return info ? info.phase >= 3 : false;
    })
    .do((c: any, e: any) => {
      e.increaseDamage(1);
    })
    .endOn()
    .done();
}
