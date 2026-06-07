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

import { type Component, For, createSignal, onCleanup } from "solid-js";
import { useUiContext } from "../hooks/context";

/**
 * 成就展示所需的数据（不含 check 等运行时字段）
 */
export interface AchievementDisplayData {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly score: number;
}

export interface AchievementToastController {
  show: (achievement: AchievementDisplayData) => void;
  hide: () => void;
}

export function createAchievementToast(): [
  AchievementToastController,
  Component,
] {
  const [achievements, setAchievements] = createSignal<AchievementDisplayData[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  const show = (achievement: AchievementDisplayData) => {
    // Clear existing timer for this achievement if any
    const existing = timers.get(achievement.id);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    setAchievements((prev) => [...prev.filter((a) => a.id !== achievement.id), achievement]);
    const timer = setTimeout(() => {
      timers.delete(achievement.id);
      setAchievements((prev) => prev.filter((a) => a.id !== achievement.id));
    }, 4000);
    timers.set(achievement.id, timer);
  };

  const hide = () => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    setAchievements([]);
  };

  const AchievementToast: Component = () => {
    const { t } = useUiContext();
    onCleanup(hide);
    return (
      <div class="achievement-toast-container">
        <For each={achievements()}>
          {(achievement) => (
            <div class="achievement-toast" data-unlocking>
              <div class="achievement-icon">
                {achievement.icon || "🏆"}
              </div>
              <div class="achievement-info">
                <div class="achievement-title">{t("achievement.unlocked")}</div>
                <div class="achievement-name">{achievement.name}</div>
                <div class="achievement-desc">{achievement.description}</div>
                <div class="achievement-score">{t("achievement.score", { score: achievement.score })}</div>
              </div>
            </div>
          )}
        </For>
      </div>
    );
  };

  return [{ show, hide }, AchievementToast];
}
