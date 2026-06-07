// Copyright (C) 2024-2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation; either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import type { AchievementPersistence } from "@gi-tcg/core";

const STORAGE_KEY = "gi-tcg:unlocked_achievements";

/**
 * 基于 localStorage 的成就持久化实现
 *
 * 适用于 Web 环境，将已解锁的成就 ID 存储在 localStorage 中。
 */
export class LocalStorageAchievementPersistence implements AchievementPersistence {
  load(): readonly number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is number => typeof id === "number");
    } catch {
      return [];
    }
  }

  save(ids: readonly number[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn("Failed to save achievements to localStorage:", e);
    }
  }
}
