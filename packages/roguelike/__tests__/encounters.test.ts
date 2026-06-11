import { describe, test, expect, vi } from "vitest";
import {
  getEnemyHp,
  getRefreshCost,
  getDeleteCost,
  getInterest,
  ENCOUNTER_CURRENCY,
  BOSS_PHASE_HP,
  SHOP_CARD_PRICE_MIN,
  SHOP_CARD_PRICE_MAX,
} from "../src/economy";
import { rollShopCards } from "../src/card-pool";
import { generateInitialDeck, generateCharacterCards } from "../src/deck";

// ============================================================
// getEnemyHp
// ============================================================

describe("getEnemyHp", () => {
  test("normal enemy floor 1 base HP is around 10", vi.fn(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const hp = getEnemyHp(1, "normal");
    expect(hp).toBeGreaterThanOrEqual(6);
    expect(hp).toBeLessThanOrEqual(15);
    vi.restoreAllMocks();
  }));

  test("elite enemy floor 1 base HP is around 20", vi.fn(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const hp = getEnemyHp(1, "elite");
    expect(hp).toBeGreaterThanOrEqual(16);
    expect(hp).toBeLessThanOrEqual(25);
    vi.restoreAllMocks();
  }));

  test("boss enemy floor 1 base HP is around 30", vi.fn(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const hp = getEnemyHp(1, "boss");
    expect(hp).toBeGreaterThanOrEqual(26);
    expect(hp).toBeLessThanOrEqual(35);
    vi.restoreAllMocks();
  }));

  test("HP scales with floor multiplier", vi.fn(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const hp1 = getEnemyHp(1, "normal");
    const hp4 = getEnemyHp(4, "normal");
    // Floor 4 multiplier is 2.5x of floor 1's 1.0x
    expect(hp4).toBeGreaterThan(hp1);
    vi.restoreAllMocks();
  }));

  test("HP is always at least 1", vi.fn(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const hp = getEnemyHp(1, "normal");
    expect(hp).toBeGreaterThanOrEqual(1);
    vi.restoreAllMocks();
  }));
});

// ============================================================
// 经济系统
// ============================================================

describe("economy", () => {
  test("ENCOUNTER_CURRENCY values", () => {
    expect(ENCOUNTER_CURRENCY.normal).toBe(5);
    expect(ENCOUNTER_CURRENCY.elite).toBe(10);
    expect(ENCOUNTER_CURRENCY.boss).toBe(30);
  });

  test("BOSS_PHASE_HP is 15", () => {
    expect(BOSS_PHASE_HP).toBe(15);
  });

  test("getRefreshCost scales exponentially", () => {
    expect(getRefreshCost(0)).toBe(2);
    expect(getRefreshCost(1)).toBe(3);
    expect(getRefreshCost(2)).toBe(5);
    expect(getRefreshCost(3)).toBe(7);
  });

  test("getDeleteCost scales exponentially", () => {
    expect(getDeleteCost(0)).toBe(10);
    expect(getDeleteCost(1)).toBe(15);
    expect(getDeleteCost(2)).toBe(23);
  });

  test("getInterest caps at threshold", () => {
    expect(getInterest(0, 50, 10)).toBe(0);
    expect(getInterest(10, 50, 10)).toBe(1);
    expect(getInterest(50, 50, 10)).toBe(5);
    expect(getInterest(100, 50, 10)).toBe(5); // capped at 50
  });
});

// ============================================================
// rollShopCards
// ============================================================

describe("rollShopCards", () => {
  test("returns requested number of cards", () => {
    const cards = rollShopCards(10);
    expect(cards).toHaveLength(10);
  });

  test("each card has cardId, name, and cost", () => {
    const cards = rollShopCards(5);
    for (const card of cards) {
      expect(card).toHaveProperty("cardId");
      expect(card).toHaveProperty("name");
      expect(card).toHaveProperty("cost");
      expect(card.cost).toBeGreaterThanOrEqual(SHOP_CARD_PRICE_MIN);
      expect(card.cost).toBeLessThanOrEqual(SHOP_CARD_PRICE_MAX);
    }
  });

  test("returns fewer cards if pool is smaller than count", () => {
    const cards = rollShopCards(1000);
    // Pool is limited, should not crash
    expect(cards.length).toBeLessThanOrEqual(1000);
  });
});

// ============================================================
// generateInitialDeck
// ============================================================

describe("generateInitialDeck", () => {
  test("generates deck with base cards + per-character cards", () => {
    // 2 characters with sword and catalyst tags
    const tagsList = [["sword", "pyro"], ["catalyst", "hydro"]];
    const deck = generateInitialDeck(tagsList);

    // Should have: 2x Best Partner + 2x Hash Brown + 2 weapons + 2 artifacts
    expect(deck.length).toBeGreaterThanOrEqual(8);
  });

  test("deck contains Best Partner and Hash Brown", () => {
    const tagsList = [["sword", "pyro"]];
    const deck = generateInitialDeck(tagsList);

    // Best Partner = 332001, Hash Brown = 333006
    const bestPartnerCount = deck.filter((id) => id === 332001).length;
    const hashBrownCount = deck.filter((id) => id === 333006).length;
    expect(bestPartnerCount).toBe(2);
    expect(hashBrownCount).toBe(2);
  });

  test("deck includes weapon matching character tag", () => {
    const tagsList = [["sword", "pyro"]];
    const deck = generateInitialDeck(tagsList);

    // Should have a sword weapon card
    const hasSwordWeapon = deck.some((id) => {
      // Sword weapons are in 311xxx range
      return id >= 311500 && id < 311600;
    });
    expect(hasSwordWeapon).toBe(true);
  });
});

// ============================================================
// generateCharacterCards
// ============================================================

describe("generateCharacterCards", () => {
  test("returns weapon + artifact for character tags", () => {
    const cards = generateCharacterCards(["sword", "pyro"]);
    expect(cards).toHaveLength(2);
  });

  test("returns default weapon for unknown weapon tag", () => {
    const cards = generateCharacterCards(["unknown_weapon", "pyro"]);
    expect(cards).toHaveLength(2);
  });
});
