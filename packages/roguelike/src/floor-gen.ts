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

import type {
  Encounter,
  EncounterType,
  EnemyScript,
  EnemyConfig,
  NodeType,
  PathNode,
} from "./types";
import { DEFAULT_ENEMY_POOL } from "./enemies";
import { getCardName, sample } from "./utils";

/** 敌人池类型（按遭遇等级分组） */
export type EnemyPool = { normal: EnemyConfig[]; elite: EnemyConfig[]; boss: EnemyConfig[] };

// ============================================================
// 遭遇创建
// ============================================================

/** 将 EnemyConfig 转换为 EnemyScript（AI 自动选择技能） */
export function enemyConfigToScript(config: EnemyConfig): EnemyScript {
  if (!config || typeof config.characterId !== "number" || config.characterId <= 0) {
    return { name: "Unknown Enemy", characters: [], cards: [], behaviors: [] };
  }
  return { name: getCardName(config.characterId), characters: [config.characterId], cards: [], behaviors: [] };
}

/** 从 EnemyConfig 创建遭遇（支持单个或多个敌人） */
export function createEncounter(type: EncounterType, configs: EnemyConfig | EnemyConfig[]): Encounter {
  const configArray = Array.isArray(configs) ? configs : [configs];
  return { type, configs: configArray };
}

/** 从遭遇配置中获取显示名称 */
export function getEncounterName(encounter: Encounter): string {
  const ids = encounter.configs.filter((c) => c?.characterId > 0).map((c) => c.characterId);
  if (ids.length === 0) return "Unknown Enemy";
  return ids.map((id) => getCardName(id)).join(" & ");
}

/** 从遭遇配置中获取所有角色 ID */
export function getEncounterCharacterIds(encounter: Encounter): number[] {
  return encounter.configs.filter((c) => c?.characterId > 0).map((c) => c.characterId);
}

// ============================================================
// 遭遇池（从默认敌人池动态生成）
// ============================================================

/** 按遭遇类型采样敌人并生成遭遇列表 */
function sampleEncounters(type: EncounterType, count: number, enemyPool?: EnemyConfig[]): Encounter[] {
  const pool = enemyPool ?? DEFAULT_ENEMY_POOL[type];
  return sample(pool, count).map((config) => createEncounter(type, config));
}

// ============================================================
// 楼层路径生成
// ============================================================

export function generateFloorPath(
  pathTypes: NodeType[],
  encounterConfigs?: (EnemyConfig[][] | null)[],
  enemyPool?: EnemyPool,
): PathNode[] {
  return pathTypes.map((type, i) => {
    if (type === "shop") return { type, encounters: [], completed: false };
    if (type === "event") return { type, encounters: [], completed: false };
    const encType = type as EncounterType;
    const preConfigured = encounterConfigs?.[i];
    if (preConfigured && preConfigured.length > 0) {
      // 每个遭遇包含多个敌人配置
      const encounters = preConfigured
        .filter((cfgs) => cfgs && cfgs.length > 0 && cfgs.some((cfg) => cfg?.characterId > 0))
        .map((cfgs) => createEncounter(encType, cfgs));
      if (encounters.length > 0) {
        return { type, encounters, completed: false };
      }
    }
    const count = type === "boss" ? 1 : 2;
    const poolForType = enemyPool?.[encType];
    return { type, encounters: sampleEncounters(encType, count, poolForType), completed: false };
  });
}
