// Copyright (C) 2025 Guyutongxue
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

/**
 * @gi-tcg/roguelike-data — Roguelike 模式的游戏数据包。
 *
 * 基于 @gi-tcg/data 的 registry 克隆，追加 roguelike 专属定义：
 * - 敌人角色与技能（如极恶骑·苏尔特洛奇）
 * - Roguelike 强化版卡牌（如赤王陵、以极限之名）
 *
 * @example
 * ```ts
 * import getRoguelikeData from "@gi-tcg/roguelike-data";
 * const data = getRoguelikeData(); // 获取 roguelike 版本的游戏数据
 * ```
 */

/**
 * 获取 roguelike 模式的游戏数据。
 * 优先使用 roguelike 版本的定义（如专属敌人、强化卡牌），
 * 回退到官方版本数据。
 */
export { default, registry } from "./end";
