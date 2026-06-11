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

import defaultConfig from "./card-weights.json";

// ============================================================
// 卡牌关联权重系统
// ============================================================

export interface CardWeightPair {
  a: number;
  b: number;
  weight: number;
}

export interface CardWeightConfig {
  version: number;
  pairs: CardWeightPair[];
}

/** 规范化无序对的 key（a < b 保证唯一） */
export function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** 将数值四舍五入到一位小数 */
export function snapWeight(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * 卡牌关联权重管理器。
 * 封装邻接表和配置，支持多实例（如多人联机时每玩家独立权重）。
 */
export class CardWeightManager {
  private static readonly EMPTY_MAP: ReadonlyMap<number, number> = new Map();
  /** 邻接表：cardId -> (relatedCardId -> weight) */
  private adjacencyMap: Map<number, Map<number, number>> = new Map();
  /** 当前配置 */
  private config: CardWeightConfig;

  constructor(config?: CardWeightConfig) {
    this.config = config ?? {
      version: defaultConfig.version,
      pairs: [...(defaultConfig.pairs as CardWeightPair[])],
    };
    this.rebuildAdjacencyMap();
  }

  /** 从配置重建邻接表 */
  private rebuildAdjacencyMap(): void {
    this.adjacencyMap.clear();
    for (const pair of this.config.pairs) {
      if (pair.weight <= 0) continue;
      let mapA = this.adjacencyMap.get(pair.a);
      if (!mapA) { mapA = new Map(); this.adjacencyMap.set(pair.a, mapA); }
      mapA.set(pair.b, pair.weight);

      let mapB = this.adjacencyMap.get(pair.b);
      if (!mapB) { mapB = new Map(); this.adjacencyMap.set(pair.b, mapB); }
      mapB.set(pair.a, pair.weight);
    }
  }

  /**
   * 查询两张卡之间的直接关联权重（不含传递）。
   */
  getDirectCardWeight(a: number, b: number): number {
    if (a === b) return 1;
    return this.adjacencyMap.get(a)?.get(b) ?? 0;
  }

  /**
   * 查询两张卡之间的关联权重（含传递）。
   * 使用 Dijkstra 最大乘积路径，到达目标后提前终止。
   */
  getCardWeight(a: number, b: number): number {
    if (a === b) return 1;
    const direct = this.adjacencyMap.get(a)?.get(b);
    if (direct !== undefined) return direct;
    const result = this.singleTargetDijkstra(a, b);
    return snapWeight(result);
  }

  /** 单目标 Dijkstra：从 start 出发，找到 end 的最大乘积路径后立即返回 */
  private singleTargetDijkstra(start: number, end: number): number {
    const bestProduct = new Map<number, number>();
    bestProduct.set(start, 1);
    const queue: Array<{ node: number; product: number }> = [{ node: start, product: 1 }];

    while (queue.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].product > queue[maxIdx].product) maxIdx = i;
      }
      const { node, product } = queue[maxIdx];
      queue.splice(maxIdx, 1);

      if (node === end) return product;
      if (product < (bestProduct.get(node) ?? 0)) continue;

      const neighbors = this.adjacencyMap.get(node);
      if (!neighbors) continue;
      for (const [neighbor, weight] of neighbors) {
        const newProduct = product * weight;
        if (newProduct > (bestProduct.get(neighbor) ?? 0)) {
          bestProduct.set(neighbor, newProduct);
          queue.push({ node: neighbor, product: newProduct });
        }
      }
    }
    return 0;
  }

  /**
   * 设置两张卡之间的关联权重（对称）。
   * weight 为 0 时删除关联。
   */
  setCardWeight(a: number, b: number, weight: number): void {
    // 增量更新 pairs 数组
    this.config.pairs = this.config.pairs.filter(
      (p) => !((p.a === a && p.b === b) || (p.a === b && p.b === a))
    );
    if (weight > 0) {
      this.config.pairs.push({ a, b, weight });
    }
    // 增量更新邻接表（无需全量重建）
    this.adjacencyMap.get(a)?.delete(b);
    this.adjacencyMap.get(b)?.delete(a);
    if (weight > 0) {
      let mapA = this.adjacencyMap.get(a);
      if (!mapA) { mapA = new Map(); this.adjacencyMap.set(a, mapA); }
      mapA.set(b, weight);
      let mapB = this.adjacencyMap.get(b);
      if (!mapB) { mapB = new Map(); this.adjacencyMap.set(b, mapB); }
      mapB.set(a, weight);
    }
  }

  /** 清空所有手动设置的关联权重。 */
  clearAllWeights(): void {
    this.config.pairs = [];
    this.rebuildAdjacencyMap();
  }

  /** 批量加载权重对（仅重建一次邻接表）。 */
  loadPairs(pairs: CardWeightPair[]): void {
    this.config.pairs = pairs.filter((p) => p.weight > 0);
    this.rebuildAdjacencyMap();
  }

  /** 获取所有非零权重的卡牌对。 */
  getAllWeightPairs(): CardWeightPair[] {
    return [...this.config.pairs];
  }

  /** 获取与指定卡牌直接关联的所有卡牌。 */
  getRelatedCards(cardId: number): ReadonlyMap<number, number> {
    return this.adjacencyMap.get(cardId) ?? CardWeightManager.EMPTY_MAP;
  }

  /**
   * 计算卡池中每张卡的权重（基于当前卡组）。
   * 使用多源扩散算法：从所有已拥有卡同时出发，沿边传播关联信号。
   */
  computeCardWeights(pool: number[], deck: number[]): number[] {
    const deckSet = new Set(deck);
    const uniqueDeck = [...deckSet];

    const alpha = 0.5;
    const maxRounds = 4;
    const minContribution = 0.01;

    const signal = new Map<number, number>();
    for (const id of uniqueDeck) signal.set(id, 1);

    const processed = new Set<number>(deckSet);
    let frontier = uniqueDeck;
    for (let round = 0; round < maxRounds; round++) {
      const nextFrontierSet = new Set<number>();
      const roundWeight = Math.pow(alpha, round + 1);
      for (const node of frontier) {
        const nodeSignal = signal.get(node) ?? 0;
        const neighbors = this.adjacencyMap.get(node);
        if (!neighbors) continue;
        for (const [neighbor, edgeWeight] of neighbors) {
          if (processed.has(neighbor)) continue;
          const contribution = nodeSignal * edgeWeight * roundWeight;
          if (contribution < minContribution) continue;
          signal.set(neighbor, (signal.get(neighbor) ?? 0) + contribution);
          nextFrontierSet.add(neighbor);
        }
      }
      for (const id of nextFrontierSet) processed.add(id);
      frontier = [...nextFrontierSet];
    }

    return pool.map((id) => 1 + (signal.get(id) ?? 0));
  }
}

// ============================================================
// 默认实例（单人模式向后兼容）
// ============================================================

export const defaultCardWeightManager = new CardWeightManager();

// 向后兼容的独立函数（委托给默认实例）
export const getDirectCardWeight = (a: number, b: number) => defaultCardWeightManager.getDirectCardWeight(a, b);
export const getCardWeight = (a: number, b: number) => defaultCardWeightManager.getCardWeight(a, b);
export const setCardWeight = (a: number, b: number, weight: number) => defaultCardWeightManager.setCardWeight(a, b, weight);
export const clearAllWeights = () => defaultCardWeightManager.clearAllWeights();
export const loadPairs = (pairs: CardWeightPair[]) => defaultCardWeightManager.loadPairs(pairs);
export const getAllWeightPairs = () => defaultCardWeightManager.getAllWeightPairs();
export const getRelatedCards = (cardId: number) => defaultCardWeightManager.getRelatedCards(cardId);
export const computeCardWeights = (pool: number[], deck: number[]) => defaultCardWeightManager.computeCardWeights(pool, deck);
