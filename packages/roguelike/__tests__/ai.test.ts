import { describe, test, expect } from "vitest";
import { createSimpleAI } from "../src/ai";

// Mock GameData with skill type information
function createMockGameData() {
  const characters = new Map();
  // Mock character with normal(11), elemental(12), burst(13)
  characters.set(1001, {
    skills: [
      { id: 10011, skillType: "normal" },
      { id: 10012, skillType: "elemental" },
      { id: 10013, skillType: "burst" },
    ],
  });
  // Mock character with two elemental skills
  characters.set(2001, {
    skills: [
      { id: 20011, skillType: "normal" },
      { id: 20012, skillType: "elemental" },
      { id: 20013, skillType: "elemental" },
      { id: 20014, skillType: "burst" },
    ],
  });
  return { characters, entities: new Map(), extensions: new Map(), attachments: new Map() };
}

const mockData = createMockGameData() as any;

// Mock Action type matching the engine's structure
interface MockAction {
  action?: { $case: string; value: { skillDefinitionId: number } };
  autoSelectedDice: any[];
  validity: number;
}

function makeSkillAction(skillId: number, validity = 0): MockAction {
  return {
    action: { $case: "useSkill", value: { skillDefinitionId: skillId } },
    autoSelectedDice: [],
    validity,
  };
}

function makeCardAction(validity = 0): MockAction {
  return {
    action: { $case: "playCard", value: {} as any },
    autoSelectedDice: [],
    validity,
  };
}

function makeEndAction(): MockAction {
  return {
    action: { $case: "declareEnd", value: {} as any },
    autoSelectedDice: [],
    validity: 0,
  };
}

/** Build RPC request in the format dispatchRpc expects */
function makeRpcRequest(caseName: string, value: any) {
  return { request: { $case: caseName, value } } as any;
}

/** Extract response value from RPC result */
function getResponseValue(result: any): any {
  return result.response.value;
}

// ============================================================
// createSimpleAI
// ============================================================

describe("createSimpleAI", () => {
  test("returns a PlayerIO with notify and rpc", () => {
    const ai = createSimpleAI(mockData);
    expect(ai).toHaveProperty("notify");
    expect(ai).toHaveProperty("rpc");
    expect(typeof ai.notify).toBe("function");
    expect(typeof ai.rpc).toBe("function");
  });

  test("notify does not throw", () => {
    const ai = createSimpleAI(mockData);
    expect(() => ai.notify({} as any)).not.toThrow();
  });
});

// ============================================================
// AI action selection (via rpc)
// ============================================================

describe("AI action selection", () => {
  test("prefers burst over other skills", async () => {
    const ai = createSimpleAI(mockData);
    const normalSkill = makeSkillAction(10011); // %10 = 1 (normal)
    const elementalSkill = makeSkillAction(10012); // %10 = 2 (elemental)
    const burstSkill = makeSkillAction(10013); // %10 = 3 (burst)
    const endAction = makeEndAction();

    const result = await ai.rpc(makeRpcRequest("action", {
      action: [normalSkill, elementalSkill, burstSkill, endAction],
    }));

    const value = getResponseValue(result);
    // burst is at index 2
    expect(value.chosenActionIndex).toBe(2);
  });

  test("prefers elemental over normal when no burst", async () => {
    const ai = createSimpleAI(mockData);
    const normalSkill = makeSkillAction(10011);
    const elementalSkill = makeSkillAction(10012);
    const endAction = makeEndAction();

    const result = await ai.rpc(makeRpcRequest("action", {
      action: [normalSkill, elementalSkill, endAction],
    }));

    const value = getResponseValue(result);
    expect(value.chosenActionIndex).toBe(1);
  });

  test("falls back to card when no skills available", async () => {
    const ai = createSimpleAI(mockData);
    const cardAction = makeCardAction();
    const endAction = makeEndAction();

    const result = await ai.rpc(makeRpcRequest("action", {
      action: [cardAction, endAction],
    }));

    const value = getResponseValue(result);
    expect(value.chosenActionIndex).toBe(0);
  });

  test("falls back to declareEnd when nothing else available", async () => {
    const ai = createSimpleAI(mockData);
    const endAction = makeEndAction();

    const result = await ai.rpc(makeRpcRequest("action", {
      action: [endAction],
    }));

    const value = getResponseValue(result);
    expect(value.chosenActionIndex).toBe(0);
  });

  test("handles empty actions array", async () => {
    const ai = createSimpleAI(mockData);

    const result = await ai.rpc(makeRpcRequest("action", {
      action: [],
    }));

    const value = getResponseValue(result);
    expect(value.chosenActionIndex).toBe(0);
  });

  test("skips invalid actions", async () => {
    const ai = createSimpleAI(mockData);
    const invalidBurst = makeSkillAction(10013, 1); // validity=1 (not VALID)
    const validNormal = makeSkillAction(10011, 0);
    const endAction = makeEndAction();

    const result = await ai.rpc(makeRpcRequest("action", {
      action: [invalidBurst, validNormal, endAction],
    }));

    const value = getResponseValue(result);
    // AI returns original array index, not filtered index
    // validNormal is at index 1 in the original array
    expect(value.chosenActionIndex).toBe(1);
  });
});

// ============================================================
// AI other RPCs
// ============================================================

describe("AI other RPC handlers", () => {
  test("chooseActive returns first candidate", async () => {
    const ai = createSimpleAI(mockData);
    const result = await ai.rpc(makeRpcRequest("chooseActive", {
      candidateIds: [101, 102, 103],
    }));

    const value = getResponseValue(result);
    expect(value.activeCharacterId).toBe(101);
  });

  test("rerollDice returns empty array", async () => {
    const ai = createSimpleAI(mockData);
    const result = await ai.rpc(makeRpcRequest("rerollDice", {
      dice: [],
    }));

    const value = getResponseValue(result);
    expect(value.diceToReroll).toEqual([]);
  });

  test("switchHands returns empty array", async () => {
    const ai = createSimpleAI(mockData);
    const result = await ai.rpc(makeRpcRequest("switchHands", {
      handIds: [],
    }));

    const value = getResponseValue(result);
    expect(value.removedHandIds).toEqual([]);
  });

  test("selectCard returns first candidate", async () => {
    const ai = createSimpleAI(mockData);
    const result = await ai.rpc(makeRpcRequest("selectCard", {
      candidateDefinitionIds: [332001, 333006],
    }));

    const value = getResponseValue(result);
    expect(value.selectedDefinitionId).toBe(332001);
  });
});
