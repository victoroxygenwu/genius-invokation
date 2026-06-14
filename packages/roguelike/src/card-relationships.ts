// Copyright (C) 2024-2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import charactersData from "@gi-tcg/assets-manager/data/CHS/characters";
import actionCardsData from "@gi-tcg/assets-manager/data/CHS/action_cards";
import entitiesData from "@gi-tcg/assets-manager/data/CHS/entities";
import { getCardName } from "./utils";
import { pairKey } from "./card-weights";
import {
  ENEMY_CHARACTER_IDS,
  ELEMENTAL_RESONANCE_CARDS,
  ELEMENTAL_TRANSMUTATION_CARDS,
  REGION_RESONANCE_CARDS,
} from "./data";

// ============================================================
// 卡牌关系自动分析
// ============================================================

export interface SuggestedPair {
  a: number;
  b: number;
  weight: number;
  reason: string;
  category: string;
}

// 角色原始数据（从 assets-manager 导入）
interface CharacterRaw {
  id: number;
  name: string;
  tags: string[];
  obtainable: boolean;
  skills: Array<{
    id: number;
    name: string;
    type: string;
    description: string;
    rawDescription: string;
  }>;
}

// 行动牌原始数据
interface ActionCardRaw {
  id: number;
  name: string;
  tags: string[];
  obtainable: boolean;
  relatedCharacterId: number | null;
  relatedCharacterTags: string[];
  description: string;
  rawDescription: string;
}

// 实体/衍生牌原始数据
interface EntityRaw {
  id: number;
  type: string;
  name: string;
  description: string;
  tags: string[];
  skills: Array<{
    id: number;
    name: string;
    type: string;
    description: string;
  }>;
}

// 标签常量映射
const ELEMENT_TAGS: Record<string, string> = {
  GCG_TAG_ELEMENT_CRYO: "cryo",
  GCG_TAG_ELEMENT_HYDRO: "hydro",
  GCG_TAG_ELEMENT_PYRO: "pyro",
  GCG_TAG_ELEMENT_ELECTRO: "electro",
  GCG_TAG_ELEMENT_ANEMO: "anemo",
  GCG_TAG_ELEMENT_GEO: "geo",
  GCG_TAG_ELEMENT_DENDRO: "dendro",
};

const WEAPON_TAGS: Record<string, string> = {
  GCG_TAG_WEAPON_SWORD: "sword",
  GCG_TAG_WEAPON_CLAYMORE: "claymore",
  GCG_TAG_WEAPON_POLE: "pole",
  GCG_TAG_WEAPON_CATALYST: "catalyst",
  GCG_TAG_WEAPON_BOW: "bow",
};

const ELEMENT_KEYWORDS: Record<string, string[]> = {
  cryo: ["冰元素", "冰伤害"],
  hydro: ["水元素", "水伤害"],
  pyro: ["火元素", "火伤害"],
  electro: ["雷元素", "雷伤害"],
  anemo: ["风元素", "风伤害"],
  geo: ["岩元素", "岩伤害"],
  dendro: ["草元素", "草伤害"],
};

// 预计算 Object.entries，避免循环内重复调用
const WEAPON_TAG_ENTRIES = Object.entries(WEAPON_TAGS);
const ELEMENT_KEYWORD_ENTRIES = Object.entries(ELEMENT_KEYWORDS);

// 逆向查找表：cardId → element（元素共鸣牌）
const RESONANCE_CARD_ELEMENT: Map<number, string> = new Map();
for (const [el, ids] of Object.entries(ELEMENTAL_RESONANCE_CARDS)) {
  for (const id of ids) RESONANCE_CARD_ELEMENT.set(id, el);
}
// 逆向查找表：cardId → elements[]（元素幻变牌）
const TRANSMUTATION_CARD_ELEMENTS: Map<number, string[]> = new Map();
for (const { id, elements } of ELEMENTAL_TRANSMUTATION_CARDS) {
  TRANSMUTATION_CARD_ELEMENTS.set(id, elements);
}
// 逆向查找表：cardId → nation（地区共鸣牌）
const REGION_RESONANCE_CARD_NATION: Map<number, string> = new Map();
for (const [nation, ids] of Object.entries(REGION_RESONANCE_CARDS)) {
  for (const id of ids) REGION_RESONANCE_CARD_NATION.set(id, nation);
}

// 描述文本关键词 → 标签映射（静态数据，只读）
const KEYWORD_TO_TAGS: ReadonlyArray<{
  readonly keyword: string;
  readonly targetTags: readonly string[];
  readonly weight: number;
  readonly label: string;
  readonly excludeIfSelfTag: boolean;
}> = [
  { keyword: "「伙伴」", targetTags: ["GCG_TAG_ALLY"], weight: 0.7, label: "伙伴", excludeIfSelfTag: false },
  { keyword: "「场地」", targetTags: ["GCG_TAG_PLACE"], weight: 0.7, label: "场地", excludeIfSelfTag: false },
  { keyword: "「圣遗物」", targetTags: ["GCG_TAG_ARTIFACT"], weight: 0.7, label: "圣遗物", excludeIfSelfTag: true },
  { keyword: "「武器」", targetTags: ["GCG_TAG_WEAPON"], weight: 0.7, label: "武器", excludeIfSelfTag: true },
  { keyword: "「料理」", targetTags: ["GCG_TAG_FOOD"], weight: 0.7, label: "料理", excludeIfSelfTag: true },
  { keyword: "「特技」", targetTags: ["GCG_TAG_VEHICLE"], weight: 0.7, label: "特技", excludeIfSelfTag: true },
  { keyword: "「道具」", targetTags: ["GCG_TAG_ITEM"], weight: 0.5, label: "道具", excludeIfSelfTag: false },
  { keyword: "「装备牌」", targetTags: ["GCG_TAG_WEAPON", "GCG_TAG_ARTIFACT", "GCG_TAG_VEHICLE"], weight: 0.6, label: "装备", excludeIfSelfTag: true },
];

// ============================================================
// 效果关键词类别（统一分析框架，支持三种匹配方式）
//
//   tag       — 卡牌标签匹配（仅 card↔card）
//   entityTag — 实体标签匹配（card↔card + card↔char）
//   仅 keywords — 描述文本匹配（card↔card + card↔char）
//
// 扩展方式：在 KEYWORD_CATEGORIES 数组中新增条目即可。
// ============================================================

interface KeywordCategory {
  readonly keywords: readonly string[];
  readonly label: string;
  readonly cardToCharWeight: number;
  readonly cardToCardWeight: number;
  /** 实体标签：技能/卡牌引用的实体若带此标签，则关联 */
  readonly entityTag?: string;
  /** 正则模糊匹配（与 keywords 并列，任一命中即匹配） */
  readonly pattern?: RegExp;
}

/** 检查文本是否匹配某类别（keywords 子串 或 pattern 正则） */
function matchesCategory(cat: KeywordCategory, text: string): boolean {
  if (cat.keywords.some(kw => text.includes(kw))) return true;
  if (cat.pattern && cat.pattern.test(text)) return true;
  return false;
}

const KEYWORD_CATEGORIES: readonly KeywordCategory[] = [
  // ── 实体标签匹配（技能衍生的实体标签）──────────────────
  { keywords: ["准备技能"], label: "准备技能", cardToCharWeight: 0.40, cardToCardWeight: 0.30, entityTag: "GCG_TAG_PREPARE_SKILL" },
  { keywords: ["夜魂", "夜魂值"], label: "夜魂", cardToCharWeight: 0.45, cardToCardWeight: 0.35, entityTag: "GCG_TAG_NYX_STATE" },
  { keywords: ["下落攻击"], label: "下落攻击", cardToCharWeight: 0.45, cardToCardWeight: 0.35, entityTag: "GCG_TAG_FALL_ATTACK" },
  { keywords: ["冒险"], label: "冒险", cardToCharWeight: 0.35, cardToCardWeight: 0.25, entityTag: "GCG_TAG_ADVENTURE_PLACE" },

  // ── 文本匹配（无对应标签，用描述中的关键词匹配）─────
  { keywords: ["重击"], label: "重击", cardToCharWeight: 0.40, cardToCardWeight: 0.30 },
  { keywords: ["普通攻击"], label: "普通攻击", cardToCharWeight: 0.35, cardToCardWeight: 0.25 },
  { keywords: ["元素战技"], label: "元素战技", cardToCharWeight: 0.40, cardToCardWeight: 0.30 },
  { keywords: ["受到伤害或治疗", "治疗"], label: "治疗", cardToCharWeight: 0.40, cardToCardWeight: 0.30 },
  { keywords: ["生命之契"], label: "生命之契", cardToCharWeight: 0.45, cardToCardWeight: 0.35 },
  { keywords: ["不属于初始卡组的牌", "不属于初始牌组的牌", "不存在于本局最初牌组的牌", "挑选"], label: "随机", cardToCharWeight: 0.35, cardToCardWeight: 0.30 },
  { keywords: ["召唤物", "召唤"], label: "召唤", cardToCharWeight: 0.45, cardToCardWeight: 0.35 },
  { keywords: ["舍弃"], label: "舍弃", cardToCharWeight: 0.40, cardToCardWeight: 0.30 },
  { keywords: ["元素爆发", "充能"], label: "元素爆发/充能", cardToCharWeight: 0.40, cardToCardWeight: 0.30 },
  { keywords: ["赋予", "赋能", "费用降低"], label: "赋予", cardToCharWeight: 0.35, cardToCardWeight: 0.30 },
  { keywords: ["快速行动", "敏捷切换"], label: "快速行动", cardToCharWeight: 0.40, cardToCardWeight: 0.30 },
  { keywords: ["切换角色", "高效切换"], label: "切换角色", cardToCharWeight: 0.40, cardToCardWeight: 0.30 },
  { keywords: ["抓牌"], label: "抓牌", cardToCharWeight: 0.40, cardToCardWeight: 0.30, pattern: /抓\d*张牌/ },
];

/** 硬编码的"随机"类卡牌 ID 集合（人为筛选，替代关键词匹配） */
const RANDOM_CARD_IDS: ReadonlySet<number> = new Set([
  322027, 322021, 322024, 322025, 322026, 322029, 322030, 322031,
  311112, 311308, 313005, 313002,
  321023, 321024, 321027, 321029, 321030, 321020,
  331004, 331005, 331006, 331007, 331008, 331009,
  322033,
  332031, 332032, 332040, 332043, 332044, 332045, 332049, 332061,
  333018, 332060, 332029,
]);

/** 获取可获得的非怪物天赋行动牌 */
function getObtainableCards(): ActionCardRaw[] {
  return (actionCardsData as unknown as ActionCardRaw[]).filter(c =>
    c.obtainable && !(c.tags.includes("GCG_TAG_TALENT") && c.relatedCharacterId && ENEMY_CHARACTER_IDS.has(c.relatedCharacterId))
  );
}

/**
 * 卡牌关系分析器。
 * 封装角色索引，支持多实例。
 */
export class CardRelationshipAnalyzer {
  private charById = new Map<number, CharacterRaw>();
  private charsByElement = new Map<string, number[]>();
  private charsByWeapon = new Map<string, number[]>();
  private charsByNation = new Map<string, number[]>();
  private entityById = new Map<number, EntityRaw>();
  private initialized = false;

  private initCharacterMaps(): void {
    if (this.initialized) return;
    this.initialized = true;
    const chars = (charactersData as unknown as CharacterRaw[]).filter(c =>
      c.obtainable && !ENEMY_CHARACTER_IDS.has(c.id)
    );
    for (const c of chars) {
      this.charById.set(c.id, c);
      for (const tag of c.tags) {
        const el = ELEMENT_TAGS[tag];
        if (el) {
          if (!this.charsByElement.has(el)) this.charsByElement.set(el, []);
          this.charsByElement.get(el)!.push(c.id);
        }
        const wp = WEAPON_TAGS[tag];
        if (wp) {
          if (!this.charsByWeapon.has(wp)) this.charsByWeapon.set(wp, []);
          this.charsByWeapon.get(wp)!.push(c.id);
        }
        if (tag.startsWith("GCG_TAG_NATION_")) {
          const nation = tag.replace("GCG_TAG_NATION_", "").toLowerCase();
          if (!this.charsByNation.has(nation)) this.charsByNation.set(nation, []);
          this.charsByNation.get(nation)!.push(c.id);
        }
      }
    }

    // 构建实体索引（仅加载有描述或技能的实体，用于衍生牌分析）
    const entities = entitiesData as unknown as EntityRaw[];
    for (const e of entities) {
      if (e.description || e.skills.length > 0) {
        this.entityById.set(e.id, e);
      }
    }
  }

  /**
   * 构建有角色限制的卡牌 → 允许关联的角色集合。
   * 武器牌、元素共鸣、元素幻变、地区共鸣牌只能关联满足条件的角色。
   * 返回值中无记录的卡牌 = 无限制。
   */
  private buildCardCharConstraints(cards: ActionCardRaw[]): Map<number, Set<number>> {
    const constraints = new Map<number, Set<number>>();

    for (const card of cards) {
      const allowed = new Set<number>();

      // 武器牌：仅同武器类型角色
      for (const tag of card.tags) {
        const wp = WEAPON_TAGS[tag];
        if (wp) {
          for (const charId of this.charsByWeapon.get(wp) ?? []) allowed.add(charId);
          break; // 一张卡只有一个武器类型
        }
      }

      // 元素共鸣牌：仅同元素角色
      const resonanceEl = RESONANCE_CARD_ELEMENT.get(card.id);
      if (resonanceEl) {
        for (const charId of this.charsByElement.get(resonanceEl) ?? []) allowed.add(charId);
      }

      // 元素幻变牌：仅所需元素角色的并集
      const transmutationEls = TRANSMUTATION_CARD_ELEMENTS.get(card.id);
      if (transmutationEls) {
        for (const el of transmutationEls) {
          for (const charId of this.charsByElement.get(el) ?? []) allowed.add(charId);
        }
      }

      // 地区共鸣牌：仅同地区角色
      const regionNation = REGION_RESONANCE_CARD_NATION.get(card.id);
      if (regionNation) {
        for (const charId of this.charsByNation.get(regionNation) ?? []) allowed.add(charId);
      }

      if (allowed.size > 0) {
        constraints.set(card.id, allowed);
      }
    }

    return constraints;
  }

  // ============================================================
  // 文本语料构建助手
  // ============================================================

  /** 去除富文本标记（<color=...>...</color> 等） */
  private stripMarkup(text: string): string {
    return text.replace(/<[^>]+>/g, "");
  }

  /** 从 rawDescription 中提取 $[C{digits}] 实体引用 */
  private extractEntityRefs(rawDesc: string): number[] {
    if (!rawDesc) return [];
    const refs: number[] = [];
    const re = /\$\[C(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawDesc)) !== null) {
      refs.push(parseInt(m[1], 10));
    }
    return refs;
  }

  /** 构建角色的文本语料（技能描述 + 衍生实体描述） */
  private getCharacterCorpus(char: CharacterRaw): string {
    const parts: string[] = [];
    const visited = new Set<number>();

    for (const skill of char.skills) {
      if (skill.description) {
        parts.push(this.stripMarkup(skill.description));
      }
      // 追踪技能衍生的实体
      for (const entityId of this.extractEntityRefs(skill.rawDescription)) {
        if (visited.has(entityId)) continue;
        visited.add(entityId);
        const entity = this.entityById.get(entityId);
        if (entity) {
          if (entity.description) {
            parts.push(this.stripMarkup(entity.description));
          }
          for (const es of entity.skills) {
            if (es.description) {
              parts.push(this.stripMarkup(es.description));
            }
          }
        }
      }
    }
    return parts.join("\n");
  }

  /** 构建卡牌的文本语料（卡牌描述 + 衍生实体描述） */
  private getCardCorpus(card: ActionCardRaw): string {
    const parts: string[] = [];
    if (card.description) {
      parts.push(this.stripMarkup(card.description));
    }
    // 追踪卡牌衍生的实体
    if (card.rawDescription) {
      const visited = new Set<number>();
      for (const entityId of this.extractEntityRefs(card.rawDescription)) {
        if (visited.has(entityId)) continue;
        visited.add(entityId);
        const entity = this.entityById.get(entityId);
        if (entity?.description) {
          parts.push(this.stripMarkup(entity.description));
        }
      }
    }
    return parts.join("\n");
  }

  // ============================================================
  // 第四层：效果关键词深层分析
  // ============================================================

  /** 检查实体是否带有指定标签 */
  private entityHasTag(entityId: number, tag: string): boolean {
    const entity = this.entityById.get(entityId);
    return entity?.tags?.includes(tag) ?? false;
  }

  /** 卡牌是否衍生（引用）带指定标签的实体 */
  private cardRefsEntityWithTag(card: ActionCardRaw, tag: string): boolean {
    if (!card.rawDescription) return false;
    return this.extractEntityRefs(card.rawDescription).some(eid => this.entityHasTag(eid, tag));
  }

  /** 角色技能是否衍生（引用）带指定标签的实体 */
  private charRefsEntityWithTag(char: CharacterRaw, tag: string): boolean {
    for (const skill of char.skills) {
      if (skill.rawDescription && this.extractEntityRefs(skill.rawDescription).some(eid => this.entityHasTag(eid, tag))) {
        return true;
      }
    }
    return false;
  }

  /**
   * 基于效果关键词类别进行卡牌↔角色和卡牌↔卡牌关联。
   * 两遍分析：
   *   1. 实体标签遍 — entityTag 匹配的类别通过衍生实体标签匹配
   *   2. 文本遍 — 仅有关键词的类别用描述文本匹配
   */
  private analyzeKeywordRelationships(
    cards: ActionCardRaw[],
    talentCardIds: Set<number>,
    seen: Set<string>,
    addPair: (a: number, b: number, weight: number, reason: string, category: SuggestedPair["category"]) => void,
  ): void {
    // 分类
    const entityTag: Array<{ ci: number; cat: KeywordCategory }> = [];
    const textOnly: Array<{ ci: number; cat: KeywordCategory }> = [];
    for (let ci = 0; ci < KEYWORD_CATEGORIES.length; ci++) {
      const cat = KEYWORD_CATEGORIES[ci];
      if (cat.entityTag) {
        entityTag.push({ ci, cat });
      } else {
        textOnly.push({ ci, cat });
      }
    }

    // ============================================================
    // 第一遍：实体标签匹配（card↔card + card↔char）
    // ============================================================

    // 卡牌 → 允许关联的角色集合（武器/元素共鸣/幻变/地区共鸣等有角色限制的卡牌）
    const cardConstraintChars = this.buildCardCharConstraints(cards);

    if (entityTag.length > 0) {
      // 匹配实体标签的卡牌 / 角色
      const etagCards = new Map<number, Set<number>>();
      for (const card of cards) {
        const matched = new Set<number>();
        for (const { ci, cat } of entityTag) {
          if (this.cardRefsEntityWithTag(card, cat.entityTag!)) {
            matched.add(ci);
          }
        }
        if (matched.size > 0) etagCards.set(card.id, matched);
      }

      const etagChars = new Map<number, Set<number>>();
      for (const [charId, char] of this.charById) {
        const matched = new Set<number>();
        for (const { ci, cat } of entityTag) {
          if (this.charRefsEntityWithTag(char, cat.entityTag!)) {
            matched.add(ci);
          }
        }
        if (matched.size > 0) etagChars.set(charId, matched);
      }

      // 倒排索引
      const eciToCards = new Map<number, number[]>();
      const eciToChars = new Map<number, number[]>();
      for (const [cardId, cats] of etagCards) {
        for (const ci of cats) {
          if (!eciToCards.has(ci)) eciToCards.set(ci, []);
          eciToCards.get(ci)!.push(cardId);
        }
      }
      for (const [charId, cats] of etagChars) {
        for (const ci of cats) {
          if (!eciToChars.has(ci)) eciToChars.set(ci, []);
          eciToChars.get(ci)!.push(charId);
        }
      }

      // card ↔ char
      for (const [ci, matchedCards] of eciToCards) {
        const matchedChars = eciToChars.get(ci);
        if (!matchedChars || matchedChars.length === 0) continue;
        const cat = KEYWORD_CATEGORIES[ci];
        for (const cardId of matchedCards) {
          if (talentCardIds.has(cardId)) continue;
          const allowedChars = cardConstraintChars.get(cardId);
          for (const charId of matchedChars) {
            if (allowedChars && !allowedChars.has(charId)) continue;
            addPair(cardId, charId, cat.cardToCharWeight,
              `实体标签「${cat.label}」关联`,
              cat.label);
          }
        }
      }

      // card ↔ card（天赋牌之间互不关联）
      for (const [ci, matchedCards] of eciToCards) {
        if (matchedCards.length < 2 || matchedCards.length > 60) continue;
        const cat = KEYWORD_CATEGORIES[ci];
        for (let i = 0; i < matchedCards.length; i++) {
          for (let j = i + 1; j < matchedCards.length; j++) {
            if (talentCardIds.has(matchedCards[i]) && talentCardIds.has(matchedCards[j])) continue;
            addPair(matchedCards[i], matchedCards[j], cat.cardToCardWeight,
              `共享实体标签「${cat.label}」`,
              cat.label);
          }
        }
      }
    }

    // ============================================================
    // 第二遍：文本匹配
    // ============================================================
    if (textOnly.length > 0) {
      // 构建角色语料并匹配
      const charCategories = new Map<number, Set<number>>();
      for (const [charId, char] of this.charById) {
        const corpus = this.getCharacterCorpus(char);
        if (!corpus) continue;
        const matched = new Set<number>();
        for (const { ci, cat } of textOnly) {
          if (matchesCategory(cat, corpus)) {
            matched.add(ci);
          }
        }
        if (matched.size > 0) charCategories.set(charId, matched);
      }

      // 构建卡牌语料并匹配
      const cardCategories = new Map<number, Set<number>>();
      for (const card of cards) {
        const corpus = this.getCardCorpus(card);
        if (!corpus) continue;
        const matched = new Set<number>();
        for (const { ci, cat } of textOnly) {
          if (matchesCategory(cat, corpus)) {
            matched.add(ci);
          }
        }
        if (matched.size > 0) cardCategories.set(card.id, matched);
      }

      // 倒排索引
      const catToCards = new Map<number, number[]>();
      const catToChars = new Map<number, number[]>();
      for (const [cardId, cats] of cardCategories) {
        for (const ci of cats) {
          if (!catToCards.has(ci)) catToCards.set(ci, []);
          catToCards.get(ci)!.push(cardId);
        }
      }
      for (const [charId, cats] of charCategories) {
        for (const ci of cats) {
          if (!catToChars.has(ci)) catToChars.set(ci, []);
          catToChars.get(ci)!.push(charId);
        }
      }

      // card ↔ char
      for (const [ci, matchedCards] of catToCards) {
        const matchedChars = catToChars.get(ci);
        if (!matchedChars || matchedChars.length === 0) continue;
        const cat = KEYWORD_CATEGORIES[ci];
        for (const cardId of matchedCards) {
          if (talentCardIds.has(cardId)) continue;
          const allowedChars = cardConstraintChars.get(cardId);
          for (const charId of matchedChars) {
            if (allowedChars && !allowedChars.has(charId)) continue;
            addPair(cardId, charId, cat.cardToCharWeight,
              `效果关键词「${cat.label}」关联`,
              cat.label);
          }
        }
      }

      // card ↔ card（天赋牌之间互不关联）
      for (const [ci, matchedCards] of catToCards) {
        if (matchedCards.length > 60) continue;
        const cat = KEYWORD_CATEGORIES[ci];
        for (let i = 0; i < matchedCards.length; i++) {
          for (let j = i + 1; j < matchedCards.length; j++) {
            if (talentCardIds.has(matchedCards[i]) && talentCardIds.has(matchedCards[j])) continue;
            addPair(matchedCards[i], matchedCards[j], cat.cardToCardWeight,
              `共享效果关键词「${cat.label}」`,
              cat.label);
          }
        }
      }
    }
  }

  /**
   * 自动分析所有可获得行动牌之间的关联关系。
   * 分四层：
   * 1. 结构化数据（标签、类型、关联角色）→ 天赋/共鸣/武器/元素
   * 2. 描述文本中的卡牌类型关键词 → 同类别卡牌关联
   * 3. 描述文本中的特定卡牌名 → 直接关联
   * 4. 效果关键词深层分析（技能/衍生牌描述）→ 语义关联
   */
  analyzeRelationships(): SuggestedPair[] {
    this.initCharacterMaps();

    // 排除怪物天赋牌（relatedCharacterId 属于怪物角色的天赋牌）
    const cards = getObtainableCards();
    const pairs: SuggestedPair[] = [];
    const seen = new Set<string>();

    const addPair = (a: number, b: number, weight: number, reason: string, category: SuggestedPair["category"]): void => {
      const key = pairKey(a, b);
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ a, b, weight, reason, category });
    };

    // ============================================================
    // 第一层：结构化标签分析
    // ============================================================

    for (const card of cards) {
      // 1. 天赋牌 → 绑定角色
      if (card.tags.includes("GCG_TAG_TALENT") && card.relatedCharacterId) {
        const charId = card.relatedCharacterId;
        if (this.charById.has(charId)) {
          addPair(card.id, charId, 0.9,
            `天赋牌「${card.name}」专属角色「${getCardName(charId)}」`,
            "天赋");
        }
      }

      // 2. 元素共鸣牌 → 同元素角色
      if (card.tags.includes("GCG_TAG_RESONANCE")) {
        for (const tag of card.relatedCharacterTags) {
          const el = ELEMENT_TAGS[tag];
          if (el) {
            const charIds = this.charsByElement.get(el) ?? [];
            for (const charId of charIds) {
              addPair(card.id, charId, 0.7,
                `元素共鸣「${card.name}」需要${el}元素角色`,
                "元素共鸣");
            }
          }
        }
      }

      // 2b. 元素幻变牌 → 从描述中提取关联元素
      if (card.tags.includes("GCG_TAG_CARD_BLESSING")) {
        const desc = card.description || "";
        const matchedElements = new Set<string>();
        for (const [el, keywords] of ELEMENT_KEYWORD_ENTRIES) {
          if (keywords.some(kw => desc.includes(kw))) {
            matchedElements.add(el);
          }
        }
        for (const el of matchedElements) {
          const charIds = this.charsByElement.get(el) ?? [];
          for (const charId of charIds) {
            addPair(card.id, charId, 0.6,
              `元素幻变「${card.name}」涉及${el}元素`,
              "元素幻变");
          }
        }
      }

      // 3. 武器牌 → 对应武器类型角色
      for (const [tag, weaponType] of WEAPON_TAG_ENTRIES) {
        if (card.tags.includes(tag)) {
          const charIds = this.charsByWeapon.get(weaponType) ?? [];
          for (const charId of charIds) {
            addPair(card.id, charId, 0.5,
              `武器牌「${card.name}」（${weaponType}）可装备`,
              "武器");
          }
        }
      }

      // 4. 圣遗物牌 → 描述中提到特定元素的角色
      if (card.tags.includes("GCG_TAG_ARTIFACT")) {
        const desc = card.description || "";
        for (const [el, keywords] of ELEMENT_KEYWORD_ENTRIES) {
          if (keywords.some(kw => desc.includes(kw))) {
            const charIds = this.charsByElement.get(el) ?? [];
            for (const charId of charIds) {
              addPair(card.id, charId, 0.3,
                `圣遗物「${card.name}」效果涉及${el}元素`,
                "元素");
            }
          }
        }
      }
    }

    // ============================================================
    // 第二层：描述文本中的卡牌类型关键词分析
    // ============================================================

    // 天赋牌 ID 集合（天赋牌之间互不关联）
    const talentCardIdSet = new Set(
      cards.filter(c => c.tags.includes("GCG_TAG_TALENT")).map(c => c.id)
    );

    const cardsByTag = new Map<string, ActionCardRaw[]>();
    for (const card of cards) {
      for (const tag of card.tags) {
        if (!cardsByTag.has(tag)) cardsByTag.set(tag, []);
        cardsByTag.get(tag)!.push(card);
      }
    }

    for (const card of cards) {
      const desc = card.description || "";
      if (!desc) continue;

      for (const rule of KEYWORD_TO_TAGS) {
        if (!desc.includes(rule.keyword)) continue;

        if (rule.excludeIfSelfTag && rule.targetTags.some(t => card.tags.includes(t))) {
          continue;
        }

        const kwIndex = desc.indexOf(rule.keyword);
        const beforeKw = desc.slice(Math.max(0, kwIndex - 30), kwIndex);
        if (/费用/.test(beforeKw) && /至少|以上/.test(beforeKw)) continue;

        const targetCards = new Set<ActionCardRaw>();
        for (const tag of rule.targetTags) {
          for (const target of (cardsByTag.get(tag) ?? [])) {
            if (target.id !== card.id) targetCards.add(target);
          }
        }

        for (const target of targetCards) {
          if (talentCardIdSet.has(card.id) && talentCardIdSet.has(target.id)) continue;
          addPair(card.id, target.id, rule.weight,
            `「${card.name}」描述含${rule.keyword}`,
            rule.label);
        }
      }
    }

    // ============================================================
    // 第三层：特定卡牌名称引用分析
    // ============================================================

    const cardNameToId = new Map<string, number>();
    for (const card of cards) {
      if (card.name.length >= 2) cardNameToId.set(card.name, card.id);
    }

    for (const card of cards) {
      const desc = card.description || "";
      if (!desc) continue;

      for (const [name, targetId] of cardNameToId) {
        if (targetId === card.id) continue;
        if (talentCardIdSet.has(card.id) && talentCardIdSet.has(targetId)) continue;
        if (desc.includes(name)) {
          addPair(card.id, targetId, 0.6,
            `「${card.name}」描述中提到「${name}」`,
            "synergy");
        }
      }
    }

    // ============================================================
    // 第四层：效果关键词深层分析
    // ============================================================
    this.analyzeKeywordRelationships(cards, talentCardIdSet, seen, addPair);

    // ============================================================
    // 第五层：硬编码"随机"类卡牌关联
    // ============================================================
    const randomCards = cards.filter(c => RANDOM_CARD_IDS.has(c.id));
    if (randomCards.length >= 2) {
      for (let i = 0; i < randomCards.length; i++) {
        for (let j = i + 1; j < randomCards.length; j++) {
          if (talentCardIdSet.has(randomCards[i].id) && talentCardIdSet.has(randomCards[j].id)) continue;
          addPair(randomCards[i].id, randomCards[j].id, 0.35,
            `随机类卡牌关联`,
            "随机");
        }
      }
    }

    return pairs;
  }

  /**
   * 获取所有角色的基本信息（用于编辑器展示）。
   */
  getAllCharacters(): Array<{ id: number; name: string; element: string; weapon: string }> {
    this.initCharacterMaps();
    const result: Array<{ id: number; name: string; element: string; weapon: string }> = [];
    for (const [id, c] of this.charById) {
      let element = "", weapon = "";
      for (const tag of c.tags) {
        if (ELEMENT_TAGS[tag]) element = ELEMENT_TAGS[tag];
        if (WEAPON_TAGS[tag]) weapon = WEAPON_TAGS[tag];
      }
      result.push({ id, name: c.name, element, weapon });
    }
    return result;
  }
}

// ============================================================
// 默认实例（单人模式向后兼容）
// ============================================================

export const defaultCardRelationshipAnalyzer = new CardRelationshipAnalyzer();

// 向后兼容的独立函数（委托给默认实例）
export const analyzeRelationships = () => defaultCardRelationshipAnalyzer.analyzeRelationships();
export const getAllCharacters = () => defaultCardRelationshipAnalyzer.getAllCharacters();

/** 获取全量分析卡池（所有可获得行动牌，排除怪物天赋牌） */
export function getFullCardPool(): Array<{ cardId: number; name: string }> {
  const cards = getObtainableCards();
  return cards.map(c => ({ cardId: c.id, name: c.name }));
}

