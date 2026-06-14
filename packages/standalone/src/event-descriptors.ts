import type { EventConditionType, EventEffectType } from "@gi-tcg/roguelike";
import { getCardName } from "./roguelike-assets";

// ============================================================
// 字段描述符（编辑器 UI）
// ============================================================

/** 编辑器字段描述符：定义事件条件/效果的某个参数的 UI 控件类型 */
export type FieldDescriptor =
  | { key: string; label?: string; type: "number"; min: number; max: number }
  | { key: string; label?: string; type: "entityId"; entityKind: "card" | "character" | "enemy" }
  | { key: string; label?: string; type: "select"; options: readonly (readonly [string, string])[] }
  | { key: string; label?: string; type: "multiSelect"; options: readonly (readonly [string, string])[] }
  | { key: string; label?: string; type: "idArray"; placeholder: string }
  | { key: string; label?: string; type: "tagSelect" };

// ============================================================
// 描述符接口
// ============================================================

/** 条件类型描述符：标签、字段列表、人类可读描述、默认值 */
export interface ConditionDescriptor {
  type: string;
  label: string;
  fields: FieldDescriptor[];
  describe: (data: any) => string;
  default: EventConditionType;
}

/** 效果类型描述符：标签、字段列表、人类可读描述、默认值 */
export interface EffectDescriptor {
  type: string;
  label: string;
  fields: FieldDescriptor[];
  describe: (data: any) => string;
  default: EventEffectType;
}

// ============================================================
// 共享选项
// ============================================================

const ELEMENT_OPTIONS: readonly (readonly [string, string])[] = [
  ["pyro", "火"], ["hydro", "水"], ["anemo", "风"], ["electro", "雷"],
  ["dendro", "草"], ["cryo", "冰"], ["geo", "岩"],
] as const;

const TAG_OPTIONS: readonly (readonly [string, string])[] = [
  ...ELEMENT_OPTIONS,
  ["mondstadt", "蒙德"], ["liyue", "璃月"], ["inazuma", "稻妻"],
  ["sumeru", "须弥"], ["fontaine", "枫丹"], ["natlan", "纳塔"], ["nodkrai", "诺德卡莱"],
  ["sword", "单手剑"], ["claymore", "双手剑"], ["pole", "长柄武器"], ["catalyst", "法器"], ["bow", "弓"],
] as const;

// ============================================================
// 条件描述符注册表
// ============================================================

export const CONDITION_DESCRIPTORS: Record<EventConditionType["type"], ConditionDescriptor> = {
  hasCard: {
    type: "hasCard",
    label: "拥有卡牌",
    fields: [
      { key: "cardId", type: "entityId", entityKind: "card" },
      { key: "minCount", label: "≥", type: "number", min: 1, max: 2 },
    ],
    describe: (d) => `卡组中有 ${getCardName(d.cardId)}${(d.minCount ?? 1) > 1 ? ` ×${d.minCount}` : ""}`,
    default: { type: "hasCard", cardId: 332001, minCount: 1 },
  },
  hasAnyCards: {
    type: "hasAnyCards",
    label: "拥有任意卡牌",
    fields: [
      { key: "cardIds", type: "idArray", placeholder: "卡牌ID（逗号分隔）" },
    ],
    describe: (d) => `卡组中有 ${(d.cardIds ?? []).map((id: number) => getCardName(id)).join("/")} 之一`,
    default: { type: "hasAnyCards", cardIds: [] },
  },
  hasCharacterTag: {
    type: "hasCharacterTag",
    label: "角色标签",
    fields: [
      { key: "tag", type: "select", options: TAG_OPTIONS },
      { key: "minCount", label: "≥", type: "number", min: 1, max: 4 },
    ],
    describe: (d) => `队伍中有 ${d.minCount ?? 1} 个 ${d.tag} 角色`,
    default: { type: "hasCharacterTag", tag: "pyro", minCount: 1 },
  },
  hasCharacter: {
    type: "hasCharacter",
    label: "拥有角色",
    fields: [
      { key: "characterId", type: "entityId", entityKind: "character" },
    ],
    describe: (d) => `队伍中有 ${getCardName(d.characterId)}`,
    default: { type: "hasCharacter", characterId: 1501 },
  },
  hasAllCharacters: {
    type: "hasAllCharacters",
    label: "拥有全部角色",
    fields: [
      { key: "characterIds", type: "idArray", placeholder: "角色ID（逗号分隔）" },
    ],
    describe: (d) => `队伍中有 ${(d.characterIds ?? []).map((id: number) => getCardName(id)).join(" 和 ")}`,
    default: { type: "hasAllCharacters", characterIds: [1501, 1502] },
  },
  noCharacter: {
    type: "noCharacter",
    label: "没有角色",
    fields: [
      { key: "characterId", type: "entityId", entityKind: "character" },
    ],
    describe: (d) => `队伍中没有 ${getCardName(d.characterId)}`,
    default: { type: "noCharacter", characterId: 1501 },
  },
  defeatedEnemy: {
    type: "defeatedEnemy",
    label: "击败敌人",
    fields: [
      { key: "enemyId", type: "entityId", entityKind: "enemy" },
    ],
    describe: (d) => `已击败 ${getCardName(d.enemyId)}`,
    default: { type: "defeatedEnemy", enemyId: 2001 },
  },
  floorAtLeast: {
    type: "floorAtLeast",
    label: "到达楼层",
    fields: [
      { key: "floor", type: "number", min: 1, max: 10 },
    ],
    describe: (d) => `到达第 ${d.floor} 层`,
    default: { type: "floorAtLeast", floor: 1 },
  },
  currencyAtLeast: {
    type: "currencyAtLeast",
    label: "费用达到",
    fields: [
      { key: "amount", type: "number", min: 1, max: 999 },
    ],
    describe: (d) => `费用 ≥ ${d.amount}`,
    default: { type: "currencyAtLeast", amount: 10 },
  },
  deckSizeAtLeast: {
    type: "deckSizeAtLeast",
    label: "卡组数量",
    fields: [
      { key: "count", type: "number", min: 1, max: 100 },
    ],
    describe: (d) => `卡组 ≥ ${d.count} 张`,
    default: { type: "deckSizeAtLeast", count: 10 },
  },
  teamSizeAtLeast: {
    type: "teamSizeAtLeast",
    label: "队伍人数≥",
    fields: [
      { key: "count", type: "number", min: 1, max: 4 },
    ],
    describe: (d) => `队伍 ≥ ${d.count} 人`,
    default: { type: "teamSizeAtLeast", count: 2 },
  },
  teamSizeAtMost: {
    type: "teamSizeAtMost",
    label: "队伍人数≤",
    fields: [
      { key: "count", type: "number", min: 1, max: 4 },
    ],
    describe: (d) => `队伍 ≤ ${d.count} 人`,
    default: { type: "teamSizeAtMost", count: 3 },
  },
  teamOnlyElements: {
    type: "teamOnlyElements",
    label: "队伍仅含元素",
    fields: [
      { key: "elements", type: "multiSelect", options: ELEMENT_OPTIONS },
    ],
    describe: (d) => `队伍仅由 ${(d.elements ?? []).join("/")} 元素构成`,
    default: { type: "teamOnlyElements", elements: ["pyro", "electro"] },
  },
  anyEventCompleted: {
    type: "anyEventCompleted",
    label: "完成任意事件",
    fields: [
      { key: "eventIds", type: "idArray", placeholder: "事件ID（逗号分隔）" },
    ],
    describe: (d) => `已完成事件：${(d.eventIds ?? []).join(", ")}`,
    default: { type: "anyEventCompleted", eventIds: [] },
  },
  noEventCompleted: {
    type: "noEventCompleted",
    label: "未完成事件",
    fields: [
      { key: "eventIds", type: "idArray", placeholder: "事件ID（逗号分隔）" },
    ],
    describe: (d) => `未完成事件：${(d.eventIds ?? []).join(", ")}`,
    default: { type: "noEventCompleted", eventIds: [] },
  },
};

// ============================================================
// 效果描述符注册表
// ============================================================

export const EFFECT_DESCRIPTORS: Record<EventEffectType["type"], EffectDescriptor> = {
  addCurrency: {
    type: "addCurrency",
    label: "增加费用",
    fields: [
      { key: "amount", type: "number", min: 1, max: 999 },
    ],
    describe: (d) => `获得 ${d.amount} 费用`,
    default: { type: "addCurrency", amount: 5 },
  },
  removeCurrency: {
    type: "removeCurrency",
    label: "减少费用",
    fields: [
      { key: "amount", type: "number", min: 1, max: 999 },
    ],
    describe: (d) => `失去 ${d.amount} 费用`,
    default: { type: "removeCurrency", amount: 5 },
  },
  addCard: {
    type: "addCard",
    label: "添加卡牌",
    fields: [
      { key: "cardId", type: "entityId", entityKind: "card" },
      { key: "count", label: "×", type: "number", min: 1, max: 2 },
    ],
    describe: (d) => `获得 ${getCardName(d.cardId)}${(d.count ?? 1) > 1 ? ` ×${d.count}` : ""}`,
    default: { type: "addCard", cardId: 332001, count: 1 },
  },
  removeCard: {
    type: "removeCard",
    label: "移除卡牌",
    fields: [
      { key: "cardId", type: "entityId", entityKind: "card" },
      { key: "count", label: "×", type: "number", min: 1, max: 2 },
    ],
    describe: (d) => `移除 ${getCardName(d.cardId)}${(d.count ?? 1) > 1 ? ` ×${d.count}` : ""}`,
    default: { type: "removeCard", cardId: 332001, count: 1 },
  },
  modifyCharacterMaxHp: {
    type: "modifyCharacterMaxHp",
    label: "修改角色HP上限",
    fields: [
      { key: "characterId", type: "entityId", entityKind: "character" },
      { key: "amount", type: "number", min: -99, max: 99 },
    ],
    describe: (d) => `${d.amount > 0 ? "+" : ""}${d.amount} 角色生命上限`,
    default: { type: "modifyCharacterMaxHp", amount: 3 },
  },
  addCharacter: {
    type: "addCharacter",
    label: "添加角色",
    fields: [
      { key: "characterId", type: "entityId", entityKind: "character" },
    ],
    describe: (d) => `获得角色：${getCardName(d.characterId)}`,
    default: { type: "addCharacter", characterId: 1501 },
  },
  modifyNextBattleAllyHp: {
    type: "modifyNextBattleAllyHp",
    label: "下场战斗我方HP",
    fields: [
      { key: "amount", type: "number", min: -99, max: 99 },
    ],
    describe: (d) => `下场战斗我方全体 HP ${d.amount > 0 ? "+" : ""}${d.amount}`,
    default: { type: "modifyNextBattleAllyHp", amount: 5 },
  },
  modifyNextBattleEnemyHp: {
    type: "modifyNextBattleEnemyHp",
    label: "下场战斗敌方HP",
    fields: [
      { key: "amount", type: "number", min: -99, max: 99 },
    ],
    describe: (d) => `下场战斗敌方全体 HP ${d.amount > 0 ? "+" : ""}${d.amount}`,
    default: { type: "modifyNextBattleEnemyHp", amount: -5 },
  },
  skipNextNormalBattle: {
    type: "skipNextNormalBattle",
    label: "跳过下一普通战斗",
    fields: [],
    describe: () => "跳过下一个普通战斗节点（无奖励）",
    default: { type: "skipNextNormalBattle" },
  },
  chooseAndRemoveCard: {
    type: "chooseAndRemoveCard",
    label: "选择删除卡牌",
    fields: [],
    describe: () => "选择删除卡组中的一张卡",
    default: { type: "chooseAndRemoveCard" },
  },
  randomCard: {
    type: "randomCard",
    label: "随机卡牌",
    fields: [
      { key: "tag", type: "tagSelect" },
      { key: "count", label: "×", type: "number", min: 1, max: 5 },
    ],
    describe: (d) => `随机获得 ${d.tag} ×${d.count ?? 1}`,
    default: { type: "randomCard", tag: "weapon", count: 1 },
  },
};
