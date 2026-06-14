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

import type { EventDefinition } from "./types";

// ============================================================
// 默认事件
// ============================================================

export const DEFAULT_EVENTS: EventDefinition[] = [
  {
    id: 2001,
    name: "初遇派蒙",
    imageUrl: "/events/2001_first_meeting_paimon.webp",
    storyTemplate: "{{playerNames}} 在旅途的起点遇到了一个奇妙的飞行生物——派蒙。她自告奋勇成为了你们的向导，并带来了两张「最好的伙伴」。",
    conditions: [],
    effects: [
      { type: "addCard", cardId: 332001, count: 2 },
    ],
  },
  {
    id: 2002,
    name: "寰宇之旅",
    imageUrl: "/events/2002_journey_across_worlds.webp",
    storyTemplate: "{{playerNames}} 在旅途中发现了一道神秘的传送门。门后似乎通往另一个世界，充满了未知的可能性。虽然旅途充满风险，但收获也颇为丰厚。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1116 }, weight: 3 },
      { condition: { type: "defeatedEnemy", enemyId: 2204 }, weight: 3 },
    ],
    effects: [
      { type: "addCurrency", amount: 10 },
      { type: "chooseAndRemoveCard" },
    ],
  },
  {
    id: 2003,
    name: "在阳光更好的日子再会",
    imageUrl: "/events/2003_reunion_on_sunnier_day.webp",
    storyTemplate: "{{playerNames}} 在须弥的旅途中遇到了一位故人。他带来了来自沙漠的消息，以及一些珍贵的物资。",
    conditions: [
      { condition: { type: "hasCharacterTag", tag: "sumeru", minCount: 2 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 321020, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 330012, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 331804, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 332040, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 332026, count: 2 },
      { type: "addCard", cardId: 322022, count: 2 },
      { type: "addCard", cardId: 332040, count: 2 },
    ],
  },
  {
    id: 2004,
    name: "要做优秀的巡林员",
    imageUrl: "/events/2004_excellent_forest_ranger.webp",
    storyTemplate: "{{playerNames}} 在化城郭遇到了正在写日记的柯莱。她分享了巡林的经验，并为你们准备了一些物资。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1701 }, weight: 2 },
      { condition: { type: "hasCharacter", characterId: 1702 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 322017, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 321014, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 217011, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 217021, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 321014, count: 2 },
      { type: "modifyNextBattleEnemyHp", amount: -10 },
    ],
  },
  {
    id: 2005,
    name: "叮呤哐啷蛋卷工坊",
    imageUrl: "/events/2005_clanging_egg_roll_workshop.webp",
    storyTemplate: "{{playerNames}} 来到了爱诺和伊涅芙的工坊。这里充满了各种奇妙的发明和改造方案。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1216 }, weight: 2 },
      { condition: { type: "hasCharacter", characterId: 1417 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 332061, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 332060, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 332062, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 212161, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 214171, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 332060, count: 1 },
      { type: "addCard", cardId: 332061, count: 1 },
      { type: "addCard", cardId: 332062, count: 1 },
    ],
  },
  {
    id: 2006,
    name: "霜月之坊",
    imageUrl: "/events/2006_frost_moon_shrine.webp",
    storyTemplate: "{{playerNames}} 来到了霜月之坊。菈乌玛正在这里制作新的作品，她热情地邀请你们参与。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1711 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 321037, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 217111, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 217111, count: 1 },
      { type: "addCard", cardId: 321037, count: 1 },
      { type: "addCurrency", amount: 5 },
    ],
  },
  {
    id: 2007,
    name: "新月之拥",
    imageUrl: "/events/2007_embrace_of_new_moon.webp",
    storyTemplate: "{{playerNames}} 在月光下感受到了一股神秘的力量。新月的光辉笼罩着你们，带来了祝福与力量。",
    conditions: [
      { condition: { type: "hasCharacterTag", tag: "nodkrai", minCount: 2 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 331807, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 331721, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 321035, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 330013, count: 1 },
      { type: "modifyNextBattleAllyHp", amount: 2 },
    ],
  },
  {
    id: 2008,
    name: "夜客致访",
    imageUrl: "/events/2008_night_visitor_arrives.webp",
    storyTemplate: "{{playerNames}} 在夜色中遇到了一位神秘的来客。他带来了来自远方的消息和一些珍贵的物品。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1418 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 321036, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 214181, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 214181, count: 2 },
      { type: "addCard", cardId: 321036, count: 2 },
      { type: "removeCurrency", amount: 5 },
    ],
  },
  {
    id: 2009,
    name: "故事的种子",
    imageUrl: "/events/2009_seed_of_story.webp",
    storyTemplate: "{{playerNames}} 在蒙德的酒馆里听到了一个古老的故事。故事中蕴含着强大的力量，为你们带来了新的可能。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1503 }, weight: 3 },
      { condition: { type: "hasCharacterTag", tag: "anemo", minCount: 2 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 331801, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 331501, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 331502, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 330004, count: 1 },
      { type: "addCard", cardId: 332019, count: 1 },
      { type: "addCard", cardId: 332024, count: 1 },
    ],
  },
  {
    id: 2010,
    name: "呀！呀！",
    imageUrl: "/events/2010_ya_ya.webp",
    storyTemplate: "{{playerNames}} 在旅途中遇到了一群吵闹的小生物。它们的叫声让人心烦意乱，但也带来了一些意外的收获。",
    conditions: [
      { condition: { type: "hasCard", cardId: 313009, minCount: 2 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 332043, minCount: 1 }, weight: 2 },
    ],
    effects: [
      { type: "addCard", cardId: 313009, count: 2 },
      { type: "addCurrency", amount: 15 },
    ],
  },
  {
    id: 2011,
    name: "闭嘴，哥们",
    imageUrl: "/events/2011_shut_up_buddy.webp",
    storyTemplate: "{{playerNames}} 在旅途中遇到了一群不友好的生物。战斗一触即发，虽然你们最终获胜，但也付出了代价。",
    conditions: [
      { condition: { type: "hasAllCharacters", characterIds: [1517, 1709] }, weight: 3 },
      { condition: { type: "hasAnyCards", cardIds: [215171, 217091, 332050, 332044] }, weight: 1 },
    ],
    effects: [
      { type: "modifyNextBattleAllyHp", amount: -5 },
      { type: "modifyNextBattleEnemyHp", amount: -10 },
      { type: "addCurrency", amount: 10 },
    ],
  },
  {
    id: 2012,
    name: "不会吧，哥们",
    imageUrl: "/events/2012_no_way_buddy.webp",
    storyTemplate: "{{playerNames}} 在旅途中发现了一条捷径。虽然需要放弃一些东西，但可以节省不少时间。",
    conditionMode: "and",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1517 }, weight: 3 },
      { condition: { type: "hasAnyCards", cardIds: [215171, 313006, 332050, 333016] }, weight: 2 },
    ],
    effects: [
      { type: "skipNextNormalBattle" },
      { type: "addCurrency", amount: 10 },
    ],
  },
  {
    id: 2013,
    name: "束手就擒！",
    imageUrl: "/events/2013_surrender_now.webp",
    storyTemplate: "{{playerNames}} 在旅途中遇到了夏沃蕾。她正在追捕一群罪犯，并邀请你们加入。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1313 }, weight: 5 },
      { condition: { type: "teamOnlyElements", elements: ["pyro", "electro"] }, weight: 3 },
    ],
    conditionMode: "and",
    effects: [
      { type: "addCard", cardId: 213131, count: 2 },
      { type: "addCard", cardId: 312030, count: 2 },
      { type: "addCard", cardId: 331301, count: 1 },
    ],
  },
  {
    id: 2016,
    name: "束手就擒！（招募）",
    imageUrl: "/events/2013_surrender_now.webp",
    storyTemplate: "{{playerNames}} 在旅途中遇到了正在追捕罪犯的夏沃蕾。她邀请你们协助，作为回报，她愿意加入你们的队伍。",
    conditions: [
      { condition: { type: "noCharacter", characterId: 1313 }, weight: 0 },
      { condition: { type: "teamOnlyElements", elements: ["pyro", "electro"] }, weight: 3 },
    ],
    conditionMode: "and",
    effects: [
      { type: "addCharacter", characterId: 1313 },
      { type: "addCard", cardId: 213131, count: 2 },
    ],
  },
  {
    id: 2014,
    name: "伟大圣龙库胡勒阿乔",
    imageUrl: "/events/2014_great_dragon_kuhuleahjo.webp",
    storyTemplate: "{{playerNames}} 遭遇了传说中的伟大圣龙库胡勒阿乔。虽然你们成功击退了它，但也消耗了不少资源。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1709 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 217091, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 313002, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 321024, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "modifyNextBattleAllyHp", amount: 5 },
      { type: "modifyNextBattleEnemyHp", amount: -5 },
      { type: "removeCurrency", amount: 5 },
    ],
  },
  {
    id: 2015,
    name: "以极限之名",
    imageUrl: "/events/2015_in_name_of_limit.webp",
    storyTemplate: "{{playerNames}} 决定挑战自己的极限。虽然获得了强大的力量，但也付出了代价。",
    conditions: [
      { condition: { type: "hasCharacter", characterId: 1709 }, weight: 2 },
      { condition: { type: "hasCharacterTag", tag: "natlan", minCount: 2 }, weight: 3 },
      { condition: { type: "hasCard", cardId: 332044, minCount: 1 }, weight: 2 },
      { condition: { type: "hasCard", cardId: 217091, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 313002, minCount: 1 }, weight: 1 },
      { condition: { type: "hasCard", cardId: 331806, minCount: 1 }, weight: 1 },
    ],
    effects: [
      { type: "addCard", cardId: 332044, count: 2 },
      { type: "addCard", cardId: 332042, count: 2 },
      { type: "addCard", cardId: 313002, count: 2 },
    ],
  },
  {
    id: 2999,
    name: "旅途小憩",
    imageUrl: "/events/2999_rest_during_journey.webp",
    storyTemplate: "{{playerNames}} 找到了一处安静的地方稍作休息，恢复了一些精力，为接下来的旅途做好了准备。",
    conditions: [],
    effects: [
      { type: "addCurrency", amount: 5 },
      { type: "modifyNextBattleAllyHp", amount: 2 },
    ],
  },
];

/** 回退事件 ID 集合 — 无其他事件可触发时随机选取一个 */
export const FALLBACK_EVENT_IDS = new Set([2999]);
