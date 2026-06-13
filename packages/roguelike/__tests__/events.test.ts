import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  evaluateEventWeight,
  getEligibleEvents,
  selectEvent,
  renderEventText,
  applyEventEffects,
  getEffectDescription,
  getConditionDescription,
} from "../src/events";
import { FALLBACK_EVENT_ID } from "../src/data";
import type {
  EventDefinition,
  EventConditionType,
  EventEffectType,
  RoguelikeRun,
} from "../src/types";

// ============================================================
// Mock Data
// ============================================================

function createMockRun(overrides?: Partial<RoguelikeRun>): RoguelikeRun {
  return {
    state: "encounterSelect",
    floor: 1,
    maxFloors: 3,
    floorSkipCharSelection: false,
    characters: [1501, 1701],
    deck: [332001, 333006, 311502],
    currency: 10,
    path: [],
    currentNodeIndex: 0,
    currentEncounter: null,
    shopItems: [],
    refreshCount: 0,
    deleteCount: 0,
    rewardItems: [],
    availableCharacters: [],
    completedEventIds: [],
    currentEvent: null,
    nextBattleAllyHpModifier: 0,
    nextBattleEnemyHpModifier: 0,
    characterHpModifiers: {},
    skipNextNormalBattle: false,
    pendingChooseAndRemoveCard: false,
    ...overrides,
  };
}

function createMockGameData() {
  const characters = new Map<number, any>();
  characters.set(1501, { tags: ["catalyst", "anemo", "mondstadt"] });
  characters.set(1701, { tags: ["bow", "dendro", "sumeru"] });
  characters.set(1301, { tags: ["claymore", "pyro", "mondstadt"] });

  const entities = new Map<number, any>();
  entities.set(332001, { type: "eventCard", name: "最好的伙伴" });
  entities.set(333006, { type: "eventCard", name: "蒙德土豆饼" });
  entities.set(311502, { type: "equipment", name: "祭礼剑" });

  return { characters, entities } as any;
}

function createEvent(overrides?: Partial<EventDefinition>): EventDefinition {
  return {
    id: 1001,
    name: "测试事件",
    imageUrl: "/test.jpg",
    storyTemplate: "测试故事",
    conditions: [],
    effects: [],
    ...overrides,
  };
}

// ============================================================
// evaluateEventWeight
// ============================================================

describe("evaluateEventWeight", () => {
  const data = createMockGameData();

  test("event with no conditions returns weight 1", () => {
    const event = createEvent({ conditions: [] });
    const run = createMockRun();
    expect(evaluateEventWeight(event, run, data)).toBe(1);
  });

  test("hasCard condition: returns 0 when card not in deck", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "hasCard", cardId: 999999 }, weight: 3 },
      ],
    });
    const run = createMockRun({ deck: [332001] });
    expect(evaluateEventWeight(event, run, data)).toBe(0);
  });

  test("hasCard condition: returns weight when card in deck", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "hasCard", cardId: 332001 }, weight: 3 },
      ],
    });
    const run = createMockRun({ deck: [332001, 332001] });
    expect(evaluateEventWeight(event, run, data)).toBeGreaterThan(0);
  });

  test("hasCard condition: scales with match count", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "hasCard", cardId: 332001, minCount: 1 }, weight: 2 },
      ],
    });
    const run1 = createMockRun({ deck: [332001] });
    const run2 = createMockRun({ deck: [332001, 332001, 332001] });
    const weight1 = evaluateEventWeight(event, run1, data);
    const weight2 = evaluateEventWeight(event, run2, data);
    // More matches = higher weight (due to log2 scaling)
    expect(weight2).toBeGreaterThanOrEqual(weight1);
  });

  test("hasCharacter condition: returns weight when character in team", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "hasCharacter", characterId: 1501 }, weight: 5 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    expect(evaluateEventWeight(event, run, data)).toBe(5);
  });

  test("hasCharacter condition: returns 0 when character not in team", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "hasCharacter", characterId: 9999 }, weight: 5 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    expect(evaluateEventWeight(event, run, data)).toBe(0);
  });

  test("hasCharacterTag condition: counts matching characters", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "hasCharacterTag", tag: "anemo", minCount: 1 }, weight: 3 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] }); // 1501 is anemo
    expect(evaluateEventWeight(event, run, data)).toBe(3);
  });

  test("noCharacter condition: returns weight when character NOT in team", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "noCharacter", characterId: 9999 }, weight: 2 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    expect(evaluateEventWeight(event, run, data)).toBe(2);
  });

  test("noCharacter condition: returns 0 when character IS in team", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "noCharacter", characterId: 1501 }, weight: 2 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    expect(evaluateEventWeight(event, run, data)).toBe(0);
  });

  test("floorAtLeast condition", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "floorAtLeast", floor: 2 }, weight: 3 },
      ],
    });
    expect(evaluateEventWeight(event, createMockRun({ floor: 1 }), data)).toBe(0);
    expect(evaluateEventWeight(event, createMockRun({ floor: 2 }), data)).toBe(3);
    expect(evaluateEventWeight(event, createMockRun({ floor: 3 }), data)).toBe(3);
  });

  test("currencyAtLeast condition", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "currencyAtLeast", amount: 10 }, weight: 2 },
      ],
    });
    expect(evaluateEventWeight(event, createMockRun({ currency: 5 }), data)).toBe(0);
    expect(evaluateEventWeight(event, createMockRun({ currency: 10 }), data)).toBe(2);
    expect(evaluateEventWeight(event, createMockRun({ currency: 20 }), data)).toBe(2);
  });

  test("OR mode: any condition satisfied accumulates weight", () => {
    const event = createEvent({
      conditionMode: "or",
      conditions: [
        { condition: { type: "hasCharacter", characterId: 1501 }, weight: 3 },
        { condition: { type: "hasCharacter", characterId: 9999 }, weight: 5 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    // Only first condition met, weight = 3
    expect(evaluateEventWeight(event, run, data)).toBe(3);
  });

  test("OR mode: multiple conditions accumulate", () => {
    const event = createEvent({
      conditionMode: "or",
      conditions: [
        { condition: { type: "hasCharacter", characterId: 1501 }, weight: 3 },
        { condition: { type: "hasCharacter", characterId: 1701 }, weight: 5 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    // Both conditions met, weight = 3 + 5 = 8
    expect(evaluateEventWeight(event, run, data)).toBe(8);
  });

  test("AND mode: all conditions must be satisfied", () => {
    const event = createEvent({
      conditionMode: "and",
      conditions: [
        { condition: { type: "hasCharacter", characterId: 1501 }, weight: 3 },
        { condition: { type: "hasCharacter", characterId: 1701 }, weight: 5 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    expect(evaluateEventWeight(event, run, data)).toBeGreaterThan(0);
  });

  test("AND mode: returns 0 if any condition not met", () => {
    const event = createEvent({
      conditionMode: "and",
      conditions: [
        { condition: { type: "hasCharacter", characterId: 1501 }, weight: 3 },
        { condition: { type: "hasCharacter", characterId: 9999 }, weight: 5 },
      ],
    });
    const run = createMockRun({ characters: [1501, 1701] });
    expect(evaluateEventWeight(event, run, data)).toBe(0);
  });

  test("teamSizeAtLeast condition", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "teamSizeAtLeast", count: 3 }, weight: 2 },
      ],
    });
    expect(evaluateEventWeight(event, createMockRun({ characters: [1501] }), data)).toBe(0);
    expect(evaluateEventWeight(event, createMockRun({ characters: [1501, 1701, 1301] }), data)).toBe(2);
  });

  test("teamSizeAtMost condition", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "teamSizeAtMost", count: 2 }, weight: 2 },
      ],
    });
    expect(evaluateEventWeight(event, createMockRun({ characters: [1501, 1701] }), data)).toBe(2);
    expect(evaluateEventWeight(event, createMockRun({ characters: [1501, 1701, 1301] }), data)).toBe(0);
  });

  test("deckSizeAtLeast condition", () => {
    const event = createEvent({
      conditions: [
        { condition: { type: "deckSizeAtLeast", count: 5 }, weight: 2 },
      ],
    });
    expect(evaluateEventWeight(event, createMockRun({ deck: [1, 2, 3] }), data)).toBe(0);
    expect(evaluateEventWeight(event, createMockRun({ deck: [1, 2, 3, 4, 5] }), data)).toBe(2);
  });
});

// ============================================================
// getEligibleEvents
// ============================================================

describe("getEligibleEvents", () => {
  const data = createMockGameData();

  test("returns events with positive weight", () => {
    const events = [
      createEvent({
        id: 1,
        conditions: [{ condition: { type: "hasCharacter", characterId: 1501 }, weight: 3 }],
      }),
      createEvent({
        id: 2,
        conditions: [{ condition: { type: "hasCharacter", characterId: 9999 }, weight: 3 }],
      }),
    ];
    const run = createMockRun({ characters: [1501, 1701] });
    const eligible = getEligibleEvents(events, run, data);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].event.id).toBe(1);
  });

  test("excludes completed events", () => {
    const events = [
      createEvent({
        id: 1,
        conditions: [{ condition: { type: "hasCharacter", characterId: 1501 }, weight: 3 }],
      }),
    ];
    const run = createMockRun({
      characters: [1501, 1701],
      completedEventIds: [1],
    });
    const eligible = getEligibleEvents(events, run, data);
    expect(eligible).toHaveLength(0);
  });

  test("excludes fallback event", () => {
    const events = [
      createEvent({
        id: FALLBACK_EVENT_ID,
        conditions: [],
      }),
    ];
    const run = createMockRun();
    const eligible = getEligibleEvents(events, run, data);
    expect(eligible).toHaveLength(0);
  });
});

// ============================================================
// selectEvent
// ============================================================

describe("selectEvent", () => {
  test("returns null for empty list", () => {
    expect(selectEvent([])).toBeNull();
  });

  test("returns single event", () => {
    const event = createEvent({ id: 1 });
    const result = selectEvent([{ event, weight: 5 }]);
    expect(result?.id).toBe(1);
  });

  test("selects based on weight (statistical)", () => {
    const event1 = createEvent({ id: 1 });
    const event2 = createEvent({ id: 2 });
    const eligible = [
      { event: event1, weight: 90 },
      { event: event2, weight: 10 },
    ];

    const counts = new Map<number, number>();
    for (let i = 0; i < 1000; i++) {
      const selected = selectEvent(eligible)!;
      counts.set(selected.id, (counts.get(selected.id) ?? 0) + 1);
    }

    // event1 should be selected ~9x more than event2
    const count1 = counts.get(1) ?? 0;
    const count2 = counts.get(2) ?? 0;
    expect(count1).toBeGreaterThan(count2 * 3); // conservative bound
  });
});

// ============================================================
// renderEventText
// ============================================================

describe("renderEventText", () => {
  const data = createMockGameData();

  test("replaces playerNames", () => {
    const run = createMockRun({ characters: [1501, 1701] });
    const result = renderEventText("{{playerNames}} 在旅行", run, data);
    expect(result).not.toContain("{{playerNames}}");
    expect(result).toContain("在旅行");
  });

  test("replaces deckSize", () => {
    const run = createMockRun({ deck: [1, 2, 3] });
    expect(renderEventText("卡组: {{deckSize}}", run, data)).toBe("卡组: 3");
  });

  test("replaces currency", () => {
    const run = createMockRun({ currency: 42 });
    expect(renderEventText("费用: {{currency}}", run, data)).toBe("费用: 42");
  });

  test("replaces floor", () => {
    const run = createMockRun({ floor: 2 });
    expect(renderEventText("楼层: {{floor}}", run, data)).toBe("楼层: 2");
  });

  test("replaces teamSize", () => {
    const run = createMockRun({ characters: [1501, 1701, 1301] });
    expect(renderEventText("队伍: {{teamSize}}", run, data)).toBe("队伍: 3");
  });

  test("keeps unknown variables as-is", () => {
    const run = createMockRun();
    expect(renderEventText("{{unknown}}", run, data)).toBe("{{unknown}}");
  });
});

// ============================================================
// applyEventEffects
// ============================================================

describe("applyEventEffects", () => {
  const data = createMockGameData();

  test("addCurrency increases currency", () => {
    const run = createMockRun({ currency: 10 });
    applyEventEffects([{ type: "addCurrency", amount: 5 }], run, data);
    expect(run.currency).toBe(15);
  });

  test("removeCurrency decreases currency (min 0)", () => {
    const run = createMockRun({ currency: 3 });
    applyEventEffects([{ type: "removeCurrency", amount: 5 }], run, data);
    expect(run.currency).toBe(0);
  });

  test("addCard adds card to deck", () => {
    const run = createMockRun({ deck: [1, 2] });
    applyEventEffects([{ type: "addCard", cardId: 99, count: 2 }], run, data);
    expect(run.deck).toEqual([1, 2, 99, 99]);
  });

  test("addCard defaults to count 1", () => {
    const run = createMockRun({ deck: [1] });
    applyEventEffects([{ type: "addCard", cardId: 99 }], run, data);
    expect(run.deck).toEqual([1, 99]);
  });

  test("removeCard removes from deck", () => {
    const run = createMockRun({ deck: [1, 2, 3, 2] });
    applyEventEffects([{ type: "removeCard", cardId: 2, count: 1 }], run, data);
    expect(run.deck).toEqual([1, 3, 2]);
  });

  test("addCharacter adds character if team not full", () => {
    const run = createMockRun({ characters: [1501, 1701] });
    applyEventEffects([{ type: "addCharacter", characterId: 1301 }], run, data);
    expect(run.characters).toEqual([1501, 1701, 1301]);
  });

  test("addCharacter does not add if team full (4)", () => {
    const run = createMockRun({ characters: [1, 2, 3, 4] });
    applyEventEffects([{ type: "addCharacter", characterId: 5 }], run, data);
    expect(run.characters).toEqual([1, 2, 3, 4]);
  });

  test("addCharacter does not add duplicate", () => {
    const run = createMockRun({ characters: [1501, 1701] });
    applyEventEffects([{ type: "addCharacter", characterId: 1501 }], run, data);
    expect(run.characters).toEqual([1501, 1701]);
  });

  test("modifyNextBattleAllyHp adds to modifier", () => {
    const run = createMockRun({ nextBattleAllyHpModifier: 0 });
    applyEventEffects([{ type: "modifyNextBattleAllyHp", amount: 5 }], run, data);
    expect(run.nextBattleAllyHpModifier).toBe(5);
  });

  test("modifyNextBattleEnemyHp adds to modifier", () => {
    const run = createMockRun({ nextBattleEnemyHpModifier: 0 });
    applyEventEffects([{ type: "modifyNextBattleEnemyHp", amount: -10 }], run, data);
    expect(run.nextBattleEnemyHpModifier).toBe(-10);
  });

  test("skipNextNormalBattle sets flag", () => {
    const run = createMockRun({ skipNextNormalBattle: false });
    applyEventEffects([{ type: "skipNextNormalBattle" }], run, data);
    expect(run.skipNextNormalBattle).toBe(true);
  });

  test("chooseAndRemoveCard sets pending flag", () => {
    const run = createMockRun({ pendingChooseAndRemoveCard: false });
    applyEventEffects([{ type: "chooseAndRemoveCard" }], run, data);
    expect(run.pendingChooseAndRemoveCard).toBe(true);
  });

  test("modifyCharacterMaxHp with specific character", () => {
    const run = createMockRun({
      characters: [1501, 1701],
      characterHpModifiers: {},
    });
    applyEventEffects([{ type: "modifyCharacterMaxHp", characterId: 1501, amount: 3 }], run, data);
    expect(run.characterHpModifiers[1501]).toBe(3);
    expect(run.characterHpModifiers[1701]).toBeUndefined();
  });

  test("modifyCharacterMaxHp without characterId applies to all", () => {
    const run = createMockRun({
      characters: [1501, 1701],
      characterHpModifiers: {},
    });
    applyEventEffects([{ type: "modifyCharacterMaxHp", amount: 2 }], run, data);
    expect(run.characterHpModifiers[1501]).toBe(2);
    expect(run.characterHpModifiers[1701]).toBe(2);
  });

  test("multiple effects applied in order", () => {
    const run = createMockRun({ currency: 10, deck: [1] });
    applyEventEffects(
      [
        { type: "addCurrency", amount: 5 },
        { type: "addCard", cardId: 99 },
      ],
      run,
      data,
    );
    expect(run.currency).toBe(15);
    expect(run.deck).toEqual([1, 99]);
  });
});

// ============================================================
// getEffectDescription / getConditionDescription
// ============================================================

describe("getEffectDescription", () => {
  const data = createMockGameData();

  test("returns description for known effect", () => {
    const desc = getEffectDescription({ type: "addCurrency", amount: 5 }, data);
    expect(desc).toContain("5");
  });

  test("returns placeholder for unknown effect", () => {
    const desc = getEffectDescription({ type: "unknownEffect" } as any, data);
    expect(desc).toContain("unknownEffect");
  });
});

describe("getConditionDescription", () => {
  const data = createMockGameData();

  test("returns description for known condition", () => {
    const desc = getConditionDescription({ type: "hasCharacter", characterId: 1501 }, data);
    expect(desc).toBeTruthy();
  });

  test("returns placeholder for unknown condition", () => {
    const desc = getConditionDescription({ type: "unknownCond" } as any, data);
    expect(desc).toContain("unknownCond");
  });
});
