import { describe, test, expect, beforeEach } from "vitest";
import {
  setCardWeight,
  clearAllWeights,
  computeCardWeights,
  getCardWeight,
  getDirectCardWeight,
  pairKey,
  snapWeight,
} from "../src/card-weights";
import { rollCards } from "../src/encounters";

beforeEach(() => {
  clearAllWeights();
});

// ============================================================
// pairKey
// ============================================================

describe("pairKey", () => {
  test("normalizes order", () => {
    expect(pairKey(1, 2)).toBe("1-2");
    expect(pairKey(2, 1)).toBe("1-2");
  });

  test("same id", () => {
    expect(pairKey(5, 5)).toBe("5-5");
  });
});

// ============================================================
// snapWeight
// ============================================================

describe("snapWeight", () => {
  test("rounds to 1 decimal", () => {
    expect(snapWeight(0.35)).toBe(0.4);
    expect(snapWeight(0.74)).toBe(0.7);
    expect(snapWeight(0.75)).toBe(0.8);
    expect(snapWeight(1)).toBe(1);
    expect(snapWeight(0.1)).toBe(0.1);
  });
});

// ============================================================
// setCardWeight / getDirectCardWeight
// ============================================================

describe("setCardWeight", () => {
  test("sets weight symmetrically", () => {
    setCardWeight(1, 2, 0.7);
    expect(getDirectCardWeight(1, 2)).toBe(0.7);
    expect(getDirectCardWeight(2, 1)).toBe(0.7);
  });

  test("weight 0 removes the pair", () => {
    setCardWeight(1, 2, 0.5);
    setCardWeight(1, 2, 0);
    expect(getDirectCardWeight(1, 2)).toBe(0);
  });

  test("overwrites existing weight", () => {
    setCardWeight(1, 2, 0.3);
    setCardWeight(1, 2, 0.8);
    expect(getDirectCardWeight(1, 2)).toBe(0.8);
  });
});

// ============================================================
// getCardWeight (transitive)
// ============================================================

describe("getCardWeight", () => {
  test("same card returns 1", () => {
    expect(getCardWeight(1, 1)).toBe(1);
  });

  test("direct weight returned directly", () => {
    setCardWeight(1, 2, 0.7);
    expect(getCardWeight(1, 2)).toBe(0.7);
  });

  test("transitive weight via Dijkstra", () => {
    // 1 --0.8--> 2 --0.6--> 3
    setCardWeight(1, 2, 0.8);
    setCardWeight(2, 3, 0.6);
    // transitive: 0.8 * 0.6 = 0.48 → rounded to 0.5
    expect(getCardWeight(1, 3)).toBe(0.5);
  });

  test("unrelated cards return 0", () => {
    setCardWeight(1, 2, 0.5);
    expect(getCardWeight(1, 99)).toBe(0);
  });
});

// ============================================================
// computeCardWeights (diffusion)
// ============================================================

describe("computeCardWeights", () => {
  test("base weight is 1 for all cards", () => {
    setCardWeight(10, 20, 0.5);
    const weights = computeCardWeights([10, 20, 30], [99]);
    // 99 has no relation to any card, so all should be ~1
    expect(weights[0]).toBe(1);
    expect(weights[1]).toBe(1);
    expect(weights[2]).toBe(1);
  });

  test("related card gets higher weight", () => {
    // Card 10 is in deck, card 20 is related to 10
    setCardWeight(10, 20, 0.8);
    const weights = computeCardWeights([20, 30], [10]);
    // 20 should have weight > 1 (related to 10)
    // 30 should have weight = 1 (unrelated)
    expect(weights[0]).toBeGreaterThan(1);
    expect(weights[1]).toBe(1);
  });

  test("multiple owned cards accumulate signal", () => {
    // Card 20 is related to both 10 and 11
    setCardWeight(10, 20, 0.5);
    setCardWeight(11, 20, 0.5);
    const weights = computeCardWeights([20], [10, 11]);
    // 20 gets signal from both 10 and 11
    expect(weights[0]).toBeGreaterThan(1);
  });
});

// ============================================================
// rollCards with weights — statistical verification
// ============================================================

describe("rollCards with weights", () => {
  test("weighted card appears more often than unweighted", () => {
    // Set up: card 200 is strongly related to card 100
    setCardWeight(100, 200, 0.9);

    // Create a pool of 10 cards, one of which (200) is related to deck card 100
    const pool = Array.from({ length: 10 }, (_, i) => (i + 1) * 100);
    const deckCards = [100];

    // Roll many times and count occurrences
    const counts = new Map<number, number>();
    const TRIALS = 2000;
    const ROLL_COUNT = 3;

    for (let t = 0; t < TRIALS; t++) {
      const cards = rollCards(ROLL_COUNT, { deckCards });
      for (const c of cards) {
        counts.set(c.cardId, (counts.get(c.cardId) ?? 0) + 1);
      }
    }

    const count200 = counts.get(200) ?? 0;
    const avgOther = pool
      .filter((id) => id !== 200)
      .reduce((sum, id) => sum + (counts.get(id) ?? 0), 0) / 9;

    // Card 200 (weight ~1.9) should appear significantly more than others (weight ~1.0)
    // Expected ratio: ~1.9/1.0 = 1.9x
    // Use 1.3x as a conservative lower bound to account for variance
    expect(count200).toBeGreaterThan(avgOther * 1.3);
  });

  test("no deckCards falls back to uniform sampling", () => {
    const pool = Array.from({ length: 5 }, (_, i) => (i + 1) * 100);
    const cards = rollCards(3);
    expect(cards).toHaveLength(3);
    // Should not throw, just uniform random
  });
});
