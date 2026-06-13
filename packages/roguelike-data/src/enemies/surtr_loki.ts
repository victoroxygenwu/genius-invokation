import {
  character,
  skill,
  status,
  card,
  DamageType,
} from "@gi-tcg/core/builder";

/**
 * @id 900201
 * @name 暴虐之怒
 * @description
 * 所附属角色生命值低于最大生命值的一半时，造成的伤害+1。
 */
const SurtrFuryInEffect = status(900201)
  .setVersionInfo("roguelike", {})
  .on("increaseDamage")
  .do((c, e) => {
    const currentHp = c.self.variables.health;
    const maxHp = c.self.variables.maxHealth;
    if (currentHp < maxHp / 2) {
      e.increaseDamage(1);
    }
  })
  .done();

/**
 * @id 90021
 * @name 碎骨雷霆
 * @description
 * 造成2点物理伤害。
 */
const SurtrNormalAttack = skill(90021)
  .setVersionInfo("roguelike", {})
  .type("normal")
  .costElectro(1)
  .costVoid(2)
  .damage(DamageType.Physical, 2)
  .done();

/**
 * @id 90022
 * @name 暗雷噬魂
 * @description
 * 造成2点雷元素伤害，对所有敌方后台角色造成1点穿透伤害。
 */
const SurtrElementalSkill = skill(90022)
  .setVersionInfo("roguelike", {})
  .type("elemental")
  .costElectro(3)
  .damage(DamageType.Electro, 2, "opp active")
  .damage(DamageType.Piercing, 1, "opp standby")
  .done();

/**
 * @id 90023
 * @name 终焉审判·万雷天罚
 * @description
 * 造成3点雷元素伤害，对所有敌方后台角色造成2点穿透伤害。
 */
const SurtrElementalBurst = skill(90023)
  .setVersionInfo("roguelike", {})
  .type("burst")
  .costElectro(4)
  .costEnergy(2)
  .damage(DamageType.Electro, 3, "opp active")
  .damage(DamageType.Piercing, 2, "opp standby")
  .done();

/**
 * @id 90024
 * @name 暴虐之怒
 * @description
 * 【被动】战斗开始时，初始附属暴虐之怒。
 */
const SurtrPassive = skill(90024)
  .setVersionInfo("roguelike", {})
  .type("passive")
  .on("battleBegin")
  .characterStatus(SurtrFuryInEffect)
  .done();

/**
 * @id 9002
 * @name 极恶骑·苏尔特洛奇
 * @description
 * 深渊的暴虐之骑，以雷霆之力碾碎一切反抗者。
 */
export const SurtrLoki = character(9002)
  .setVersionInfo("roguelike", {})
  .tags("electro", "monster", "boss")
  .health(30)
  .energy(2)
  .skills(SurtrNormalAttack, SurtrElementalSkill, SurtrElementalBurst, SurtrPassive)
  .done();

/**
 * @id 900211
 * @name 暴虐之怒·噬血
 * @description
 * 所附属角色使用技能后：治疗自身1点伤害。
 * 可用次数：3（每回合）
 */
const SurtrTalentInEffect = status(900211)
  .setVersionInfo("roguelike", {})
  .on("useSkill", (c, e) => e.isSkillType("normal") || e.isSkillType("elemental") || e.isSkillType("burst"))
  .usagePerRound(3)
  .heal(1, "@self")
  .done();

/**
 * @id 290021
 * @name 暴虐之怒
 * @description
 * 战斗行动：我方出战角色为极恶骑·苏尔特洛奇时，装备此牌。
 * 装备有此牌的极恶骑·苏尔特洛奇使用技能后：治疗自身1点伤害。（每回合3次）
 * （牌组中包含极恶骑·苏尔特洛奇，才能加入牌组）
 */
export const SurtrTalentCard = card(290021)
  .setVersionInfo("roguelike", {})
  .costElectro(3)
  .talent(SurtrLoki, "none")
  .on("enter")
  .characterStatus(SurtrFuryInEffect)
  .on("useSkill", (c, e) => e.caller.definition.id === SurtrLoki)
  .usagePerRound(3)
  .heal(1, "@self")
  .done();
