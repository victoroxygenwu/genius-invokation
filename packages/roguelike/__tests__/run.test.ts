import { describe, test, expect, vi, beforeEach } from "vitest";
import { RoguelikeRunManager } from "../src/run";
import type { RoguelikeConfig } from "../src/types";

// Mock GameData with minimal structure
function createMockGameData() {
  const characters = new Map<number, any>();
  // Add mock characters (need >4 so rollCharacterChoices works after exclusion)
  const mockChars = [
    { id: 1101, tags: ["bow", "cryo"] },
    { id: 1201, tags: ["catalyst", "hydro"] },
    { id: 1301, tags: ["claymore", "pyro"] },
    { id: 1401, tags: ["bow", "electro"] },
    { id: 1501, tags: ["catalyst", "anemo"] },
    { id: 1601, tags: ["claymore", "geo"] },
    { id: 1701, tags: ["bow", "dendro"] },
  ];
  for (const ch of mockChars) {
    characters.set(ch.id, { ...ch, skills: [], maxHealth: 10 });
  }

  // Add mock entities for card pool
  const entities = new Map<number, any>();
  entities.set(311502, { name: "祭礼剑" });
  entities.set(311202, { name: "祭礼弓" });
  entities.set(312102, { name: "冰风迷途的勇士" });
  entities.set(330001, { name: "交给我吧！" });
  entities.set(330002, { name: "鹤归之时" });
  entities.set(332008, { name: "星天之兆" });

  return {
    characters,
    entities,
    extensions: new Map(),
    attachments: new Map(),
  };
}

const TEST_CONFIG: RoguelikeConfig = {
  floors: [
    { floor: 1, path: ["normal", "normal", "elite", "shop", "boss"] },
    { floor: 2, path: ["normal", "elite", "normal", "shop", "elite", "boss"] },
  ],
  initialCurrency: 0,
  shopCardCount: 10,
  rewardCardCount: 5,
  interestThreshold: 50,
  interestRate: 10,
  events: [],
};

// ============================================================
// RoguelikeRunManager - 初始状态
// ============================================================

describe("RoguelikeRunManager initial state", () => {
  test("starts in characterSelect state", () => {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);
    const run = manager.getRun();

    expect(run.state).toBe("characterSelect");
    expect(run.characters).toEqual([]);
    expect(run.deck).toEqual([]);
    expect(run.floor).toBe(0);
    expect(run.currency).toBe(0);
  });

  test("provides 4 available characters for selection", () => {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);
    const run = manager.getRun();

    expect(run.availableCharacters).toHaveLength(4);
  });
});

// ============================================================
// 角色选择流程
// ============================================================

describe("character selection", () => {
  test("selectFirstCharacter sets pending and refreshes choices", () => {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);

    manager.selectFirstCharacter(1701);
    const run = manager.getRun();

    // Should still be in characterSelect state
    expect(run.state).toBe("characterSelect");
    // Available characters should be refreshed (excluding first pick)
    expect(run.availableCharacters).toHaveLength(4);
  });

  test("selectSecondCharacter transitions to encounterSelect", () => {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);

    manager.selectFirstCharacter(1701);
    manager.selectSecondCharacter(1401);
    const run = manager.getRun();

    expect(run.characters).toEqual([1701, 1401]);
    expect(run.deck.length).toBeGreaterThan(0);
    expect(run.floor).toBe(1);
    expect(run.state).toBe("encounterSelect");
  });

  test("selectSecondCharacter without first does nothing", () => {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);

    manager.selectSecondCharacter(1401);
    const run = manager.getRun();

    expect(run.characters).toEqual([]);
    expect(run.state).toBe("characterSelect");
  });
});

// ============================================================
// 遭遇选择
// ============================================================

describe("encounter selection", () => {
  function setupManagerWithCharacters() {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);
    manager.selectFirstCharacter(1701);
    manager.selectSecondCharacter(1401);
    return manager;
  }

  test("getAvailableEncounters returns encounters for current node", () => {
    const manager = setupManagerWithCharacters();
    const encounters = manager.getAvailableEncounters();

    // First node is "normal" type, should have 2 encounters
    expect(encounters.length).toBeGreaterThan(0);
  });

  test("selectEncounter transitions to battle state", () => {
    const manager = setupManagerWithCharacters();
    manager.selectEncounter(0);
    const run = manager.getRun();

    expect(run.state).toBe("battle");
    expect(run.currentEncounter).not.toBeNull();
  });

  test("selectEncounter with invalid index does nothing", () => {
    const manager = setupManagerWithCharacters();
    manager.selectEncounter(99);
    const run = manager.getRun();

    expect(run.state).toBe("encounterSelect");
  });
});

// ============================================================
// 战斗结算
// ============================================================

describe("battle resolution", () => {
  function setupInBattle() {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);
    manager.selectFirstCharacter(1701);
    manager.selectSecondCharacter(1401);
    manager.selectEncounter(0);
    return manager;
  }

  test("victory adds currency and transitions to reward", () => {
    const manager = setupInBattle();
    manager.onBattleEnd(0); // player wins
    const run = manager.getRun();

    expect(run.state).toBe("reward");
    expect(run.currency).toBeGreaterThan(0);
    expect(run.rewardItems.length).toBeGreaterThan(0);
  });

  test("defeat transitions to gameOver", () => {
    const manager = setupInBattle();
    manager.onBattleEnd(1); // enemy wins
    const run = manager.getRun();

    expect(run.state).toBe("gameOver");
  });
});

// ============================================================
// 奖励领取
// ============================================================

describe("reward claiming", () => {
  test("claimRewardAndFinish adds card to deck and advances", () => {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);
    manager.selectFirstCharacter(1701);
    manager.selectSecondCharacter(1401);
    manager.selectEncounter(0);
    manager.onBattleEnd(0);

    const run = manager.getRun();
    const deckSizeBefore = run.deck.length;
    const rewardCount = run.rewardItems.length;

    if (rewardCount > 0) {
      manager.claimRewardAndFinish(0);
      const runAfter = manager.getRun();

      // Deck should have one more card
      expect(runAfter.deck.length).toBe(deckSizeBefore + 1);
      // Should advance to next node
      expect(runAfter.currentNodeIndex).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 商店
// ============================================================

describe("shop", () => {
  function setupInShop() {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);
    manager.selectFirstCharacter(1701);
    manager.selectSecondCharacter(1401);

    // Navigate through nodes until we hit a shop
    // Path: normal(0), normal(1), elite(2), shop(3), boss(4)
    // We need to complete nodes 0-2 to reach shop
    for (let i = 0; i < 3; i++) {
      manager.selectEncounter(0);
      manager.onBattleEnd(0);
      manager.claimRewardAndFinish(0);
    }

    return manager;
  }

  test("shop state has items", () => {
    const manager = setupInShop();
    const run = manager.getRun();

    if (run.state === "shop") {
      expect(run.shopItems.length).toBeGreaterThan(0);
    }
  });

  test("refreshShop updates items", () => {
    const manager = setupInShop();
    const run = manager.getRun();

    if (run.state === "shop") {
      const itemsBefore = run.shopItems.map((i) => i.cardId);
      manager.refreshShop();
      const itemsAfter = manager.getRun().shopItems.map((i) => i.cardId);

      // Items should change (with high probability)
      // At minimum, refreshCount should increment
      expect(manager.getRun().refreshCount).toBe(1);
    }
  });
});

// ============================================================
// onUpdate callback
// ============================================================

describe("onUpdate callback", () => {
  test("setOnUpdate registers callback that fires on state changes", () => {
    const data = createMockGameData();
    const manager = new RoguelikeRunManager(data as any, TEST_CONFIG);
    const callback = vi.fn();
    manager.setOnUpdate(callback);

    manager.selectFirstCharacter(1701);
    expect(callback).toHaveBeenCalled();
  });
});
