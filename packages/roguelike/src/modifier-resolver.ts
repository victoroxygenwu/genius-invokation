/**
 * Modifier 解析器。
 * 将 EnemyModifier 列表转换为游戏引擎可消费的 ModifierEffect 列表。
 * 单一归属点：新增 modifier type 只需在 resolveModifier 里加 case。
 */

import { StateSymbol, type GameData, type EntityDefinition, type EntityState } from "@gi-tcg/core";
import { KNOWN_STATUS_IDS } from "./data";
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
  const defaults = Object.fromEntries(
    Object.entries(varConfigs).map(([name, cfg]) => [name, cfg.initialValue]),
  );
  const variables = variableOverrides ? { ...defaults, ...variableOverrides } : defaults;
  return { [StateSymbol]: "entity", id, definition: def, variables: variables as Record<string, number>, attachments: [] } as EntityState;
}

// ============================================================
// 解析器表
// ============================================================

type ResolvedEntity = { def: EntityDefinition; overrides?: Record<string, number> };
/** 解析函数签名：输入 modifier + 角色 ID + 实体查找函数，输出解析后的实体列表 */
type EntityResolver = (mod: EnemyModifier, charId: number, lookup: (id: number) => EntityDefinition | undefined) => ResolvedEntity[];

/** 工厂：创建始终返回指定状态 ID 的解析器，忽略 modifier 的 value 参数 */
const simpleResolver = (statusId: number): EntityResolver =>
  (_mod, _charId, lookup) => {
    const def = lookup(statusId);
    return def ? [{ def }] : [];
  };

/** value2 有值时作为次数，否则用 value；单实例 + overrides 设置初始 usage */
const usageResolver = (statusId: number): EntityResolver =>
  (mod, _charId, lookup) => {
    const def = lookup(statusId);
    const count = ("value2" in mod && typeof mod.value2 === "number") ? mod.value2 : modNum(mod, 1);
    return def ? [{ def, overrides: { usage: count } }] : [];
  };

/**
 * Modifier 类型 → 实体解析器的映射表。
 * 新增 modifier type 只需在此表添加一行。
 */
const ENTITY_RESOLVERS: Partial<Record<EnemyModifierType, EntityResolver>> = {
  /** 免疫控制：固定状态，无需参数 */
  immuneControl: simpleResolver(KNOWN_STATUS_IDS.IMMUNE_CONTROL),
  /** 复活：优先 PvE 专用复活状态，降级到通用复活；value 控制使用次数 */
  revive: (mod, _charId, lookup) => {
    const def = lookup(KNOWN_STATUS_IDS.PVE_FULL_REVIVE) ?? lookup(KNOWN_STATUS_IDS.REVIVE);
    const count = modNum(mod, 1);
    return def ? [{ def, overrides: { usage: count } }] : [];
  },
  /** 减伤：value2 优先作为次数，否则用 value，默认 1 */
  damageReduction: usageResolver(KNOWN_STATUS_IDS.DAMAGE_REDUCTION),
  /** 增伤：同减伤逻辑 */
  damageBoost: usageResolver(KNOWN_STATUS_IDS.DAMAGE_BOOST),
  /** 固有天赋：按角色 ID 计算天赋卡 ID（200000 + charId*10 + 1），仅 equipment 类型生效 */
  innateTalent: (_mod, charId, lookup) => {
    const def = lookup(getTalentCardId(charId));
    return def && def.type === "equipment" ? [{ def }] : [];
  },
  /** 固有圣遗物：value 指定圣遗物实体 ID，校验 equipment + artifact 标签 */
  innateArtifact: (mod, _charId, lookup) => {
    const def = lookup(modNum(mod, 0));
    return def && def.type === "equipment" && (def.tags as readonly string[]).includes("artifact") ? [{ def }] : [];
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
    const resolved = resolver(mod, characterId, lookup);
    for (const { def, overrides } of resolved) {
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

  // 3. 料理效果（value=0 为随机料理状态，value>0 为指定食物卡）
  if (mod.type === "autoDish") {
    const cardId = modNum(mod, 0);
    if (cardId > 0) {
      effects.push({ kind: "handCard", cardId });
    } else {
      const def = lookup(KNOWN_STATUS_IDS.AUTO_DISH_PER_ROUND);
      if (def) effects.push({ kind: "status", entity: makeEntityState(SYNTHETIC_ENTITY_ID_MODIFIER, def) });
    }
  } else if (mod.type === "innateTalent") {
    // innateTalent 的双路径处理：
    // - equipment 类型 → 在上面 ENTITY_RESOLVERS 中作为状态实体挂载
    // - 非 equipment 类型（如事件型天赋）→ 作为手牌加入
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
 * @param statusIdOffset / supportIdOffset — 多敌人场景下避免 ID 冲突的偏移量
 */
export function resolveModifiers(
  modifiers: EnemyModifier[],
  characterId: number,
  data: GameData,
  statusIdOffset = 0,
  supportIdOffset = 0,
): { statusEntities: EntityState[]; supportEntities: EntityState[]; handCardIds: number[]; hasFullEnergy: boolean } {
  let statusEntityCounter = SYNTHETIC_ENTITY_ID_MODIFIER + statusIdOffset;
  let supportEntityCounter = SYNTHETIC_ENTITY_ID_SUPPORT + supportIdOffset;
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
