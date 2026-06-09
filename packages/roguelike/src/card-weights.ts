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

/** 邻接表：cardId -> (relatedCardId -> weight) */
const adjacencyMap: Map<number, Map<number, number>> = new Map();

/** 当前配置（可被调试面板修改） */
let currentConfig: CardWeightConfig = {
  version: defaultConfig.version,
  pairs: [...defaultConfig.pairs],
};

/** 从配置重建邻接表 */
function rebuildAdjacencyMap(): void {
  adjacencyMap.clear();
  for (const pair of currentConfig.pairs) {
    if (pair.weight <= 0) continue;
    // 对称：weight(a,b) === weight(b,a)
    let mapA = adjacencyMap.get(pair.a);
    if (!mapA) { mapA = new Map(); adjacencyMap.set(pair.a, mapA); }
    mapA.set(pair.b, pair.weight);

    let mapB = adjacencyMap.get(pair.b);
    if (!mapB) { mapB = new Map(); adjacencyMap.set(pair.b, mapB); }
    mapB.set(pair.a, pair.weight);
  }
}

// 初始化时构建邻接表
rebuildAdjacencyMap();

/**
 * 查询两张卡之间的直接关联权重（不含传递）。
 * 仅用于编辑器 UI 判断是否为手动定义的直接关系。
 */
export function getDirectCardWeight(a: number, b: number): number {
  if (a === b) return 1;
  return adjacencyMap.get(a)?.get(b) ?? 0;
}

/**
 * 查询两张卡之间的关联权重（含传递）。
 * 使用 Dijkstra 最大乘积路径，到达目标后提前终止。
 * 返回 0 表示无关联，1 表示最强关联。结果四舍五入保留一位小数。
 */
export function getCardWeight(a: number, b: number): number {
  if (a === b) return 1;
  const direct = adjacencyMap.get(a)?.get(b);
  if (direct !== undefined) return direct;
  // 单源 Dijkstra，找到目标即停止
  const result = singleTargetDijkstra(a, b);
  return Math.round(result * 10) / 10;
}

/** 单目标 Dijkstra：从 start 出发，找到 end 的最大乘积路径后立即返回 */
function singleTargetDijkstra(start: number, end: number): number {
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

    const neighbors = adjacencyMap.get(node);
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
export function setCardWeight(a: number, b: number, weight: number): void {
  // 从 pairs 中移除旧值
  currentConfig.pairs = currentConfig.pairs.filter(
    (p) => !((p.a === a && p.b === b) || (p.a === b && p.b === a))
  );
  // 添加新值（如果非零）
  if (weight > 0) {
    currentConfig.pairs.push({ a, b, weight });
  }
  rebuildAdjacencyMap();
}

/**
 * 清空所有手动设置的关联权重。
 */
export function clearAllWeights(): void {
  currentConfig.pairs = [];
  rebuildAdjacencyMap();
}

/**
 * 批量加载权重对（仅重建一次邻接表）。
 */
export function loadPairs(pairs: CardWeightPair[]): void {
  currentConfig.pairs = pairs.filter((p) => p.weight > 0);
  rebuildAdjacencyMap();
}

/** 将数值四舍五入到一位小数 */
export function snapWeight(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * 获取所有非零权重的卡牌对（仅手动定义的直接关系）。
 */
export function getAllWeightPairs(): CardWeightPair[] {
  return [...currentConfig.pairs];
}

const EMPTY_MAP: ReadonlyMap<number, number> = new Map();

/**
 * 获取与指定卡牌直接关联的所有卡牌。
 */
export function getRelatedCards(cardId: number): ReadonlyMap<number, number> {
  return adjacencyMap.get(cardId) ?? EMPTY_MAP;
}

/**
 * 计算卡池中每张卡的权重（基于当前卡组）。
 * 使用多源扩散算法：从所有已拥有卡同时出发，沿边传播关联信号。
 * 多条路径会叠加，信号随距离衰减。
 *
 * 基础权重 = 1，加上扩散累积的关联信号。
 *
 * @param pool 卡池（候选卡牌 ID 列表）
 * @param deckCards 当前卡组中的卡牌 ID 列表（可含重复）
 * @returns 每张卡对应的基础权重数组，与 pool 等长
 */
export function computeCardWeights(pool: number[], deckCards: number[]): number[] {
  const deckSet = new Set(deckCards);
  const uniqueDeck = [...deckSet];

  // 扩散参数
  const alpha = 0.5;       // 每轮衰减系数
  const maxRounds = 4;     // 最大扩散轮数
  const minContribution = 0.01; // 剪枝阈值

  // signal[node] = 累积关联信号
  const signal = new Map<number, number>();
  for (const id of uniqueDeck) signal.set(id, 1);

  // 迭代扩散（每轮去重，避免同一节点被多个父节点重复推入）
  const processed = new Set<number>(deckSet);
  let frontier = uniqueDeck;
  for (let round = 0; round < maxRounds; round++) {
    const nextFrontierSet = new Set<number>();
    const roundWeight = Math.pow(alpha, round + 1);
    for (const node of frontier) {
      const nodeSignal = signal.get(node) ?? 0;
      const neighbors = adjacencyMap.get(node);
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
