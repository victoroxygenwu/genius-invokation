import { DEFAULT_ENEMY_MODIFIERS } from "./data";
import { validateIds } from "./utils";
import type { EnemyConfig, EncounterType } from "./types";

/** [characterId, tier] — name 从 assets-manager 动态获取 */
const ENEMY_DEFS: [number, EncounterType][] = [
  // Normal
  [2101, "normal"], [2104, "normal"], [2202, "normal"], [2205, "normal"],
  [2203, "normal"], [2207, "normal"], [2301, "normal"], [2303, "normal"],
  [2302, "normal"], [2404, "normal"], [2405, "normal"], [2406, "normal"],
  [2503, "normal"], [2601, "normal"], [2604, "normal"], [2703, "normal"],
  [2705, "normal"],
  // Elite
  [2103, "elite"], [2201, "elite"], [2206, "elite"], [2304, "elite"],
  [2306, "elite"], [2401, "elite"], [2402, "elite"], [2403, "elite"],
  [2501, "elite"], [2603, "elite"], [2605, "elite"], [2701, "elite"],
  [2704, "elite"],
  // Boss
  [2102, "boss"], [2204, "boss"], [2305, "boss"], [2502, "boss"],
  [2602, "boss"], [2702, "boss"],
];

function makeConfig(characterId: number): EnemyConfig {
  return { characterId, hpOverride: null, currencyReward: null, modifiers: [...DEFAULT_ENEMY_MODIFIERS] };
}

const byTier = (tier: EncounterType): EnemyConfig[] =>
  ENEMY_DEFS.filter(([, t]) => t === tier).map(([id]) => makeConfig(id));

export const ALL_NORMAL_ENEMIES = byTier("normal");
export const ALL_ELITE_ENEMIES = byTier("elite");
export const ALL_BOSS_ENEMIES = byTier("boss");

export const DEFAULT_ENEMY_POOL = {
  normal: ALL_NORMAL_ENEMIES,
  elite: ALL_ELITE_ENEMIES,
  boss: ALL_BOSS_ENEMIES,
};

/**
 * 验证 ENEMY_DEFS 中的所有 characterId 是否存在于 GameData 中。
 * 用于启动时检测数据包变更导致的 ID 失效。
 */
export function validateEnemyIds(characters: ReadonlyMap<number, unknown>): string[] {
  return validateIds(ENEMY_DEFS.map(([id]) => id), characters, "Enemy character");
}
