# Roguelike PvE Mode

七圣召唤（Genius Invokation TCG）的 Roguelike PvE 模式。玩家组建队伍、逐层推进楼层、遭遇敌人、获取奖励和卡牌强化。

## Language

**Encounter**:
一次战斗遭遇，由遭遇类型（normal/elite/boss）和敌人配置组成。
_Avoid_: battle, fight, match

**Floor**:
一个楼层，包含有序的路径节点序列（normal/elite/shop/boss）。
_Avoid_: stage, level, chapter

**Path**:
楼层内的节点序列，定义玩家的推进路线。每个节点是一个遭遇或商店。
_Avoid_: route, trail

**Run**:
一次完整的 Roguelike 游戏流程，从角色选择到胜利/失败。
_Avoid_: session, game, playthrough

**EnemyConfig**:
敌人的静态配置：角色 ID、修饰符列表、HP/货币覆盖。
_Avoid_: enemy data, monster config

**Modifier**:
敌人携带的特殊效果（元素免疫、复活、伤害减免等），通过状态实体实现。
_Avoid_: buff, debuff, effect

**Tier**:
敌人难度分级：normal（普通）、elite（精英）、boss（首领）。
_Avoid_: grade, rank, level

**CardPool**:
当前可用的卡牌集合，根据队伍角色动态生成（天赋牌、共鸣牌等）。
_Avoid_: card list, available cards

**Weight**:
卡牌之间的关联强度（0–1），用于加权随机采样。通过 Dijkstra 最大积路径计算传递权重。
_Avoid_: score, priority

**CharacterPool**:
可选角色的集合，从 GameData 动态生成（排除怪物角色）。
_Avoid_: roster, character list

**Deck**:
玩家的初始卡组，根据角色标签自动生成（武器牌、圣遗物牌、通用牌）。
_Avoid_: hand, starting cards

**Currency**:
遭遇奖励的货币，用于商店购买和利息计算。
_Avoid_: gold, coins, money

**Event**:
一个可触发的事件，包含触发条件（带权重）、剧情文本模板和效果列表。事件在 event 节点上按条件加权随机选取。
_Avoid_: story, incident

**EventCondition**:
事件的触发条件类型（hasCard、hasCharacterTag、defeatedEnemy 等），每条带权重。全部满足时事件才进入候选池。
_Avoid_: trigger, requirement

**EventEffect**:
事件的效果类型（addCurrency、addCard、modifyCharacterMaxHp 等），在事件确认时应用到运行状态。
_Avoid_: outcome, result
