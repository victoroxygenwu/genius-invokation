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

import type { EncounterType } from "./types";
import {
  FLOOR_HP_MULTIPLIER,
  BASE_HP,
  ENCOUNTER_CURRENCY,
  SHOP_CARD_PRICE_MIN,
  SHOP_CARD_PRICE_MAX,
  SHOP_COST_GROWTH_RATE,
} from "./data";

// ============================================================
// 敌人血量
// ============================================================

export function getEnemyHp(floor: number, type: "normal" | "elite" | "boss"): number {
  const base = BASE_HP[type];
  const multiplier = FLOOR_HP_MULTIPLIER[floor - 1] ?? 1.0;
  return Math.max(1, Math.round(base * multiplier));
}

export const BOSS_PHASE_HP = 15;

// ============================================================
// 经济系统
// ============================================================

/** 获取遭遇的货币奖励（configs 中第一个有效覆盖 > 类型默认值） */
export function getEncounterCurrency(encounter: { configs: { currencyReward: number | null }[]; type: EncounterType }): number {
  const firstValidConfig = encounter.configs.find((c) => c.currencyReward !== null);
  return firstValidConfig?.currencyReward ?? ENCOUNTER_CURRENCY[encounter.type] ?? 0;
}

export function getRefreshCost(refreshCount: number): number {
  return Math.round(2 * Math.pow(SHOP_COST_GROWTH_RATE, refreshCount));
}

export function getDeleteCost(deleteCount: number): number {
  return Math.round(10 * Math.pow(SHOP_COST_GROWTH_RATE, deleteCount));
}

export function getInterest(currency: number, threshold: number, rate: number): number {
  return Math.floor(Math.min(currency, threshold) / rate);
}

export { ENCOUNTER_CURRENCY, SHOP_CARD_PRICE_MIN, SHOP_CARD_PRICE_MAX };
