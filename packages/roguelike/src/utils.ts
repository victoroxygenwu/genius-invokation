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

import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";

// ============================================================
// Tauri 环境检测
// ============================================================

const IS_TAURI = "__TAURI_INTERNALS__" in globalThis;

// ============================================================
// 卡牌/角色名称和图片
// ============================================================

/** 获取卡牌名称（自动适配语言） */
export function getCardName(id: number): string {
  return DEFAULT_ASSETS_MANAGER.getNameSync(id) ?? `Card #${id}`;
}

/** 获取卡牌描述文本（用于 tooltip） */
export function getCardDescription(id: number): string {
  try {
    const data = DEFAULT_ASSETS_MANAGER.getDataSync(id) as unknown as Record<string, unknown>;
    return (data.description as string) ?? "";
  } catch {
    return "";
  }
}

/**
 * 获取卡牌/角色图片 URL。
 *
 * - Tauri 模式：返回本地相对路径 `/images/cards/{id}.webp`（从 dist-resources 复制到前端目录）
 * - Web 模式：返回远程 API URL
 */
export function getImageUrl(id: number): string {
  if (IS_TAURI) {
    return `/images/cards/${id}.webp`;
  }
  return DEFAULT_ASSETS_MANAGER.getImageUrlSync(id, { type: "cardFace" });
}

/** 图片加载失败时的占位图 */
export const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160' viewBox='0 0 120 160'%3E%3Crect fill='%23334155' width='120' height='160' rx='8'/%3E%3Ctext fill='%2394a3b8' font-size='14' x='60' y='80' text-anchor='middle' dominant-baseline='middle'%3E%3F%3C/text%3E%3C/svg%3E";

// ============================================================
// 采样工具
// ============================================================

/** Fisher-Yates 部分采样（均匀分布） */
export function sample<T>(arr: readonly T[], count: number): T[] {
  const copy = [...arr];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/** 加权随机采样（无放回） */
export function weightedSample<T>(items: T[], weights: number[], count: number): T[] {
  const remaining = [...items];
  const remainingWeights = [...weights];
  const n = Math.min(count, remaining.length);
  const result: T[] = [];

  for (let i = 0; i < n; i++) {
    const totalWeight = remainingWeights.reduce((s, w) => s + w, 0);
    if (totalWeight <= 0) break;
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < remainingWeights.length - 1; idx++) {
      r -= remainingWeights[idx];
      if (r <= 0) break;
    }
    result.push(remaining[idx]);
    remaining.splice(idx, 1);
    remainingWeights.splice(idx, 1);
  }
  return result;
}

// ============================================================
// 通用 ID 验证
// ============================================================

/**
 * 通用 ID 验证：检查 ids 中的每个 ID 是否存在于 map 中。
 * @returns 缺失 ID 的错误消息数组，全部存在时返回空数组。
 */
export function validateIds(
  ids: Iterable<number>,
  map: ReadonlyMap<number, unknown>,
  label: string,
): string[] {
  const missing: string[] = [];
  for (const id of ids) {
    if (!map.has(id)) {
      missing.push(`${label} ID ${id} not found`);
    }
  }
  return missing;
}
