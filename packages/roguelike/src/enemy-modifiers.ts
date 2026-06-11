import { validateIds } from "./utils";

/**
 * 已知可用的 status ID 列表（均在 @gi-tcg/data 中预定义）。
 *
 * 这些 ID 在运行时从 GameData.entities 中查找，
 * 不在此处调用 status() builder，避免 RegistrationScope 问题。
 */
export const KNOWN_STATUS_IDS = {
  /** 免疫控制（冻结/石化/眩晕）— 抵抗之躯 */
  IMMUNE_CONTROL: 100,
  /** 复活至 1 HP — 雷晶核心（通用，无角色限制） */
  REVIVE: 124014,
  /** 通用伤害增加 — 造成伤害 +1（每个可用次数） */
  DAMAGE_BOOST: 210,
  /** 通用伤害减免 — 受到伤害 -1（每个可用次数） */
  DAMAGE_REDUCTION: 211,
} as const;

/**
 * 验证 KNOWN_STATUS_IDS 中的所有 status ID 是否存在于 GameData 中。
 */
export function validateStatusIds(entities: ReadonlyMap<number, unknown>): string[] {
  return validateIds(Object.values(KNOWN_STATUS_IDS), entities, "Status");
}
