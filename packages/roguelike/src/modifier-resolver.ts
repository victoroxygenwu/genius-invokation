/**
 * Modifier 解析器。
 * 将 EnemyModifier 列表转换为游戏引擎可消费的 ModifierEffect 列表。
 * 单一归属点：新增 modifier type 只需在 resolveModifier 里加 case。
 */

import { StateSymbol, type GameData, type EntityDefinition, type EntityState } from "@gi-tcg/core";
import { KNOWN_STATUS_IDS } from "./enemy-modifiers";
import type { EnemyModifier, EnemyModifierType } from "./types";

// ============================================================
// 类型
// ============================================================

export type ModifierEffect =
  | { kind: "status"; entity: EntityState }
  | { kind: "support"; entity: EntityState }
  | { kind: "handCard"; cardId: number }
  | { kind: "flag"; flag: "fullEnergy" };

// ============================================================
// 常量
// ============================================================

export const SYNTHETIC_ENTITY_ID_MODIFIER = -900000;
export const SYNTHETIC_ENTITY_ID_SUPPORT = -800000;

// ============================================================
// 内部工具
// ============================================================

const modNum = (mod: EnemyModifier, fallback: number): number =>
  "value" in mod && typeof mod.value === "number" ? mod.value : fallback;

const getTalentCardId = (characterId: number): number =>
  200000 + characterId * 10 + 1;

/** 从 EntityDefinition 构建 EntityState */
export function makeEntityState(id: number, def: EntityDefinition, variableOverrides?: Record<string, number>): EntityState {
  const varConfigs = def.varConfigs ?? {};
  const variables = variableOverrides ?? Object.fromEntries(
    Object.entries(varConfigs).map(([name, cfg]) => [name, cfg.initialValue]),
  );
  return { [StateSymbol]: "entity", id, definition: def, variables: variables as Record<string, number>, attachments: [] } as EntityState;
}

// ============================================================
// 解析器表
// ============================================================

type EntityResolver = (mod: EnemyModifier, charId: number, lookup: (id: number) => EntityDefinition | undefined) => EntityDefinition[];

const simpleResolver = (statusId: number): EntityResolver =>
  (_mod, _charId, lookup) => {
    const def = lookup(statusId);
    return def ? [def] : [];
  };

const ENTITY_RESOLVERS: Partial<Record<EnemyModifierType, EntityResolver>> = {
  immuneControl: simpleResolver(KNOWN_STATUS_IDS.IMMUNE_CONTROL),
  revive: (mod, _charId, lookup) => {
    const def = lookup(KNOWN_STATUS_IDS.REVIVE);
    return def ? Array(modNum(mod, 1)).fill(def) : [];
  },
  damageReduction: simpleResolver(KNOWN_STATUS_IDS.DAMAGE_REDUCTION),
  damageBoost: simpleResolver(KNOWN_STATUS_IDS.DAMAGE_BOOST),
  innateTalent: (_mod, charId, lookup) => {
    const def = lookup(getTalentCardId(charId));
    return def && def.type === "equipment" ? [def] : [];
  },
  innateArtifact: (mod, _charId, lookup) => {
    const def = lookup(modNum(mod, 0));
    return def && def.type === "equipment" && (def.tags as readonly string[]).includes("artifact") ? [def] : [];
  },
};

// ============================================================
// 公共 API
// ============================================================

/**
 * 解析单个 modifier 的所有效果。
 * 返回 ModifierEffect 数组，调用方按 kind 分类使用。
 */
export function resolveModifier(
  mod: EnemyModifier,
  characterId: number,
  data: GameData,
): ModifierEffect[] {
  const effects: ModifierEffect[] = [];
  const lookup = (id: number) => data.entities.get(id);

  // 1. 状态实体（通过解析器表）
  const resolver = ENTITY_RESOLVERS[mod.type];
  if (resolver) {
    const needsUsageOverride = mod.type === "damageReduction" || mod.type === "damageBoost";
    const overrides = needsUsageOverride ? { usage: modNum(mod, 1) } : undefined;
    const defs = resolver(mod, characterId, lookup);
    for (const def of defs) {
      effects.push({ kind: "status", entity: makeEntityState(SYNTHETIC_ENTITY_ID_MODIFIER, def, overrides) });
    }
  }

  // 2. 支援牌
  if (mod.type === "supportCard") {
    const def = lookup(modNum(mod, 0));
    if (def && (def.type === "support" || def.type === "summon")) {
      effects.push({ kind: "support", entity: makeEntityState(SYNTHETIC_ENTITY_ID_SUPPORT, def) });
    }
  }

  // 3. 额外手牌
  if (mod.type === "autoDish") {
    const cardId = modNum(mod, 0);
    if (cardId > 0) effects.push({ kind: "handCard", cardId });
  } else if (mod.type === "innateTalent") {
    const talentId = getTalentCardId(characterId);
    const def = lookup(talentId);
    if (def && def.type !== "equipment") {
      effects.push({ kind: "handCard", cardId: talentId });
    }
  }

  // 4. 标记
  if (mod.type === "fullEnergy") {
    effects.push({ kind: "flag", flag: "fullEnergy" });
  }

  return effects;
}

/**
 * 批量解析 modifiers，返回分类后的结果。
 */
export function resolveModifiers(
  modifiers: EnemyModifier[],
  characterId: number,
  data: GameData,
): { statusEntities: EntityState[]; supportEntities: EntityState[]; handCardIds: number[]; hasFullEnergy: boolean } {
  let statusEntityCounter = SYNTHETIC_ENTITY_ID_MODIFIER;
  let supportEntityCounter = SYNTHETIC_ENTITY_ID_SUPPORT;
  const statusEntities: EntityState[] = [];
  const supportEntities: EntityState[] = [];
  const handCardIds: number[] = [];
  let hasFullEnergy = false;

  for (const mod of modifiers) {
    const effects = resolveModifier(mod, characterId, data);
    for (const effect of effects) {
      switch (effect.kind) {
        case "status":
          // 重新分配 ID 以确保唯一性（readonly 是编译期约束，运行时可写）
          (effect.entity as { id: number }).id = statusEntityCounter--;
          statusEntities.push(effect.entity);
          break;
        case "support":
          (effect.entity as { id: number }).id = supportEntityCounter--;
          supportEntities.push(effect.entity);
          break;
        case "handCard":
          handCardIds.push(effect.cardId);
          break;
        case "flag":
          if (effect.flag === "fullEnergy") hasFullEnergy = true;
          break;
      }
    }
  }

  return { statusEntities, supportEntities, handCardIds, hasFullEnergy };
}
