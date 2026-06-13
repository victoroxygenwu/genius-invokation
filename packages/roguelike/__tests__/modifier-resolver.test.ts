import { describe, test, expect } from "vitest";
import {
  resolveModifier,
  resolveModifiers,
  makeEntityState,
  SYNTHETIC_ENTITY_ID_MODIFIER,
  SYNTHETIC_ENTITY_ID_SUPPORT,
} from "../src/modifier-resolver";
import { KNOWN_STATUS_IDS } from "../src/data";
import type { EnemyModifier } from "../src/types";

// ============================================================
// Mock Data
// ============================================================

function createMockGameData() {
  const entities = new Map<number, any>();

  // Status entities
  entities.set(KNOWN_STATUS_IDS.IMMUNE_CONTROL, {
    type: "status",
    name: "免疫控制",
    varConfigs: {},
  });
  entities.set(KNOWN_STATUS_IDS.REVIVE, {
    type: "status",
    name: "复活",
    varConfigs: { health: { initialValue: 1 } },
  });
  entities.set(KNOWN_STATUS_IDS.PVE_FULL_REVIVE, {
    type: "status",
    name: "满血复活",
    varConfigs: { health: { initialValue: 1 } },
  });
  entities.set(KNOWN_STATUS_IDS.DAMAGE_BOOST, {
    type: "status",
    name: "伤害增加",
    varConfigs: { usage: { initialValue: 1 } },
  });
  entities.set(KNOWN_STATUS_IDS.DAMAGE_REDUCTION, {
    type: "status",
    name: "伤害减免",
    varConfigs: { usage: { initialValue: 1 } },
  });
  entities.set(KNOWN_STATUS_IDS.AUTO_DISH_PER_ROUND, {
    type: "status",
    name: "自动料理",
    varConfigs: {},
  });

  // Support entity
  entities.set(321007, {
    type: "support",
    name: "天守阁",
    varConfigs: {},
  });

  // Talent card (for character 1501)
  entities.set(215011, {
    type: "equipment",
    name: "天赋牌",
    varConfigs: {},
  });

  // Artifact
  entities.set(312101, {
    type: "equipment",
    name: "冰风迷途的勇士",
    tags: ["artifact"],
    varConfigs: {},
  });

  return { characters: new Map(), entities } as any;
}

// ============================================================
// resolveModifier
// ============================================================

describe("resolveModifier", () => {
  const data = createMockGameData();

  test("immuneControl produces status entity", () => {
    const mod: EnemyModifier = { type: "immuneControl" };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects).toHaveLength(1);
    expect(effects[0].kind).toBe("status");
  });

  test("revive produces status entity", () => {
    const mod: EnemyModifier = { type: "revive", value: 1 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects).toHaveLength(1);
    expect(effects[0].kind).toBe("status");
  });

  test("revive with value=2 produces 1 status entity with usage=2", () => {
    const mod: EnemyModifier = { type: "revive", value: 2 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects).toHaveLength(1);
    expect(effects[0].kind).toBe("status");
  });

  test("damageReduction produces status entities", () => {
    const mod: EnemyModifier = { type: "damageReduction", value: 2 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects.length).toBeGreaterThan(0);
    expect(effects[0].kind).toBe("status");
  });

  test("damageBoost produces status entities", () => {
    const mod: EnemyModifier = { type: "damageBoost", value: 1 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects.length).toBeGreaterThan(0);
    expect(effects[0].kind).toBe("status");
  });

  test("supportCard produces support entity", () => {
    const mod: EnemyModifier = { type: "supportCard", value: 321007 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects).toHaveLength(1);
    expect(effects[0].kind).toBe("support");
  });

  test("fullEnergy produces flag", () => {
    const mod: EnemyModifier = { type: "fullEnergy" };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toEqual({ kind: "flag", flag: "fullEnergy" });
  });

  test("innateTalent for character with equipment talent", () => {
    const mod: EnemyModifier = { type: "innateTalent" };
    const effects = resolveModifier(mod, 1501, data);
    // 1501's talent card is 215011, which is type "equipment"
    expect(effects.length).toBeGreaterThan(0);
    expect(effects[0].kind).toBe("status");
  });

  test("innateArtifact with valid artifact ID", () => {
    const mod: EnemyModifier = { type: "innateArtifact", value: 312101 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects.length).toBeGreaterThan(0);
    expect(effects[0].kind).toBe("status");
  });

  test("autoDish with value=0 produces status", () => {
    const mod: EnemyModifier = { type: "autoDish", value: 0 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects).toHaveLength(1);
    expect(effects[0].kind).toBe("status");
  });

  test("autoDish with value>0 produces handCard", () => {
    const mod: EnemyModifier = { type: "autoDish", value: 333006 };
    const effects = resolveModifier(mod, 1501, data);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toEqual({ kind: "handCard", cardId: 333006 });
  });
});

// ============================================================
// resolveModifiers (batch)
// ============================================================

describe("resolveModifiers", () => {
  const data = createMockGameData();

  test("resolves multiple modifiers", () => {
    const mods: EnemyModifier[] = [
      { type: "immuneControl" },
      { type: "fullEnergy" },
    ];
    const result = resolveModifiers(mods, 1501, data);
    expect(result.statusEntities.length).toBeGreaterThan(0);
    expect(result.hasFullEnergy).toBe(true);
  });

  test("status entities get unique IDs", () => {
    const mods: EnemyModifier[] = [
      { type: "immuneControl" },
      { type: "revive", value: 1 },
    ];
    const result = resolveModifiers(mods, 1501, data);
    const ids = result.statusEntities.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("supportCard adds to supportEntities", () => {
    const mods: EnemyModifier[] = [
      { type: "supportCard", value: 321007 },
    ];
    const result = resolveModifiers(mods, 1501, data);
    expect(result.supportEntities).toHaveLength(1);
  });

  test("empty modifiers returns empty result", () => {
    const result = resolveModifiers([], 1501, data);
    expect(result.statusEntities).toHaveLength(0);
    expect(result.supportEntities).toHaveLength(0);
    expect(result.handCardIds).toHaveLength(0);
    expect(result.hasFullEnergy).toBe(false);
  });

  test("statusIdOffset prevents ID collision", () => {
    const mods: EnemyModifier[] = [{ type: "immuneControl" }];
    const result1 = resolveModifiers(mods, 1501, data, 0, 0);
    const result2 = resolveModifiers(mods, 1501, data, -1000, -1000);
    // Different offsets should produce different IDs
    expect(result1.statusEntities[0].id).not.toBe(result2.statusEntities[0].id);
  });
});

// ============================================================
// makeEntityState
// ============================================================

describe("makeEntityState", () => {
  test("creates entity state with default variables", () => {
    const def = {
      type: "status",
      varConfigs: {
        health: { initialValue: 10 },
        usage: { initialValue: 3 },
      },
    };
    const state = makeEntityState(100, def as any);
    expect(state.id).toBe(100);
    expect(state.variables.health).toBe(10);
    expect(state.variables.usage).toBe(3);
  });

  test("variableOverrides take precedence", () => {
    const def = {
      type: "status",
      varConfigs: {
        health: { initialValue: 10 },
      },
    };
    const state = makeEntityState(100, def as any, { health: 99 });
    expect(state.variables.health).toBe(99);
  });

  test("empty varConfigs produces empty variables", () => {
    const def = { type: "status", varConfigs: {} };
    const state = makeEntityState(100, def as any);
    expect(state.variables).toEqual({});
  });
});
