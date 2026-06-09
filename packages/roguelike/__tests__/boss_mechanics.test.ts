import { describe, test, expect } from "vitest";
import { createBossPhaseExtension, createBossPhaseStatus } from "../src/boss_mechanics";

// Note: createBossPhaseExtension and createBossPhaseStatus use the builder DSL
// which requires a registration context. These functions are integration-tested
// via the game engine test suite (packages/test/__tests__/).
// Here we only verify the module exports exist.

describe("boss_mechanics exports", () => {
  test("createBossPhaseExtension is exported and callable", () => {
    expect(typeof createBossPhaseExtension).toBe("function");
  });

  test("createBossPhaseStatus is exported and callable", () => {
    expect(typeof createBossPhaseStatus).toBe("function");
  });
});
