/**
 * Roguelike 模式资源包装器
 * 优先使用本地自定义资源，回退到官方 assets-manager
 */
import { getCardName as getOfficialCardName, getImageUrl as getOfficialImageUrl, getEncounterName as getOfficialEncounterName, type Encounter } from "@gi-tcg/roguelike";
import { AssetsManager } from "@gi-tcg/assets-manager";

const ASSETS_API = "https://static-data.piovium.org/api/v4";

const ROGUELIKE_NAMES: Record<number, string> = {
  9002: "极恶骑·苏尔特洛奇",
  900201: "暴虐之怒（生效中）",
  90021: "碎骨雷霆",
  90022: "暗雷噬魂",
  90023: "终焉审判·万雷天罚",
  90024: "暴虐之怒",
  900211: "暴虐之怒（天赋牌生效中）",
  290021: "暴虐之怒",
};

const BOSS_IMAGE_URL = `${ASSETS_API}/image/122043?thumbnail=false&type=cardFace`;

const ROGUELIKE_IMAGES: Record<number, string> = {
  9002: BOSS_IMAGE_URL,
  290021: BOSS_IMAGE_URL,
};

/** 获取卡牌名称（支持 roguelike 自定义实体） */
export function getCardName(id: number): string {
  return ROGUELIKE_NAMES[id] ?? getOfficialCardName(id);
}

/** 获取卡牌图片 URL（支持 roguelike 自定义实体） */
export function getImageUrl(id: number): string {
  return ROGUELIKE_IMAGES[id] ?? getOfficialImageUrl(id);
}

/** 获取遭遇名称（支持 roguelike 自定义实体） */
export function getEncounterName(encounter: Encounter): string {
  return getOfficialEncounterName(encounter, getCardName);
}

/**
 * 创建包含 roguelike 自定义实体数据的 AssetsManager。
 * 用于战斗 UI 正确显示自定义 boss 的名称和图片。
 */
export function createRoguelikeAssetsManager(): AssetsManager {
  return new AssetsManager({
    customData: [{
      characters: [{
        id: 9002,
        name: ROGUELIKE_NAMES[9002],
        rawDescription: "当自身生命值低于生命上限的50%时，造成的伤害+1。",
        cardFaceUrl: BOSS_IMAGE_URL,
        obtainable: false,
        hp: 30,
        maxEnergy: 2,
        tags: ["electro", "monster", "boss"],
        skills: [
          { id: 90021, name: ROGUELIKE_NAMES[90021], rawDescription: "造成2点物理伤害。", skillIconUrl: "", type: "normal", playCost: [["electro", 1], ["void", 2]] },
          { id: 90022, name: ROGUELIKE_NAMES[90022], rawDescription: "对敌方前台造成2点雷元素伤害，对后台造成1点穿透伤害。", skillIconUrl: "", type: "elemental", playCost: [["electro", 3]] },
          { id: 90023, name: ROGUELIKE_NAMES[90023], rawDescription: "对敌方前台造成3点雷元素伤害，对后台造成2点雷元素伤害。", skillIconUrl: "", type: "burst", playCost: [["electro", 4], ["energy", 2]] },
          { id: 90024, name: ROGUELIKE_NAMES[90024], rawDescription: "战斗开始时，附带暴虐之怒状态。", skillIconUrl: "", type: "passive", playCost: [] },
        ],
      }],
      actionCards: [
        {
          id: 290021,
          name: ROGUELIKE_NAMES[290021],
          rawDescription: "极恶骑·苏尔特洛奇的天赋牌。\n战斗开始时，附带暴虐之怒状态。\n装备后，每次使用技能回复1点生命值，每回合至多3次。",
          cardFaceUrl: BOSS_IMAGE_URL,
          obtainable: false,
          type: "equipment",
          tags: ["talent"],
          playCost: [["electro", 3]],
        },
        {
          id: 321020,
          name: "赤王陵",
          rawDescription: "打出后，生成「赤王陵·禁忌蔓延」状态，持续2回合。\n每回合结束阶段：在对方牌库顶生成2张「禁忌知识」。",
          cardFaceUrl: `${ASSETS_API}/image/321020?thumbnail=false&type=cardFace`,
          obtainable: true,
          type: "support",
          tags: ["place"],
          playCost: [["same", 1]],
        },
        {
          id: 332044,
          name: "以极限之名",
          rawDescription: "重新随机对方的所有元素骰。",
          cardFaceUrl: `${ASSETS_API}/image/332044?thumbnail=false&type=cardFace`,
          obtainable: true,
          type: "eventCard",
          tags: ["action"],
          playCost: [["same", 3]],
        },
      ],
      entities: [
        { id: 900201, name: ROGUELIKE_NAMES[900201], rawDescription: "生命值低于50%时，造成的伤害+1。", type: "characterStatus", cardFaceOrBuffIconUrl: "", skills: [] },
        { id: 900211, name: ROGUELIKE_NAMES[900211], rawDescription: "使用技能后回复1点生命，每回合3次。", type: "characterStatus", cardFaceOrBuffIconUrl: "", skills: [] },
        // 301022 不在此处：它是官方实体，默认 AssetsManager 已有图片和数据
      ],
    }],
  });
}

/** 延迟初始化的 roguelike AssetsManager 单例 */
let _roguelikeAssetsManager: AssetsManager | null = null;
export function getRoguelikeAssetsManager(): AssetsManager {
  return (_roguelikeAssetsManager ??= createRoguelikeAssetsManager());
}
