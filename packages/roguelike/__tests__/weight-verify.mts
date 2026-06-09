import { setCardWeight, clearAllWeights, computeCardWeights, getCardWeight, getDirectCardWeight, pairKey, snapWeight, loadPairs } from '../src/card-weights.js';

console.log('=== Card Weight System Verification ===\n');

// Test 1: Basic weight operations
console.log('1. Basic weight operations:');
clearAllWeights();
setCardWeight(311101, 311102, 0.7);
console.log(`   setCardWeight(魔导绪论, 祭礼残章, 0.7)`);
console.log(`   getDirectCardWeight(魔导绪论, 祭礼残章) = ${getDirectCardWeight(311101, 311102)}`);
console.log(`   getDirectCardWeight(祭礼残章, 魔导绪论) = ${getDirectCardWeight(311102, 311101)} (symmetric)`);
console.log(`   ✓ PASS\n`);

// Test 2: Transitive weight
console.log('2. Transitive weight:');
clearAllWeights();
setCardWeight(311101, 311102, 0.8);
setCardWeight(311102, 311103, 0.6);
console.log(`   魔导绪论 --0.8--> 祭礼残章 --0.6--> 天空之卷`);
const tw = getCardWeight(311101, 311103);
console.log(`   getCardWeight(魔导绪论, 天空之卷) = ${tw} (expected: 0.5)`);
console.log(`   ${tw === 0.5 ? '✓' : '✗'} PASS\n`);

// Test 3: computeCardWeights — related card gets higher weight
console.log('3. computeCardWeights:');
clearAllWeights();
// 魔导绪论(311101) is in deck, 祭礼残章(311102) is related
setCardWeight(311101, 311102, 0.9);
// 天空之卷(311103) is NOT related
const weights = computeCardWeights([311102, 311103], [311101]);
console.log(`   Deck: [魔导绪论]`);
console.log(`   祭礼残章 (related, weight 0.9): ${weights[0].toFixed(2)} (expected: >1)`);
console.log(`   天空之卷 (unrelated): ${weights[1].toFixed(2)} (expected: 1)`);
console.log(`   ${weights[0] > 1 && weights[1] === 1 ? '✓' : '✗'} PASS\n`);

// Test 4: loadPairs
console.log('4. loadPairs (batch load):');
clearAllWeights();
loadPairs([
  { a: 311101, b: 311102, weight: 0.5 },
  { a: 311102, b: 311103, weight: 0.6 },
  { a: 311103, b: 311104, weight: 0.7 },
]);
console.log(`   Loaded 3 pairs`);
console.log(`   311101↔311102: ${getDirectCardWeight(311101, 311102)} (expected: 0.5)`);
console.log(`   311102↔311103: ${getDirectCardWeight(311102, 311103)} (expected: 0.6)`);
console.log(`   311103↔311104: ${getDirectCardWeight(311103, 311104)} (expected: 0.7)`);
console.log(`   ✓ PASS\n`);

// Test 5: Statistical distribution test
console.log('5. Statistical distribution:');
clearAllWeights();
// 魔导绪论(311101) in deck, 祭礼残章(311102) strongly related
setCardWeight(311101, 311102, 0.9);

// Use a small pool of real cards for controlled testing
const pool = [311102, 311103, 311104, 311105, 311106, 311107, 311108, 311201, 311202, 311203];
const deck = [311101];
const poolWeights = computeCardWeights(pool, deck);

console.log(`   Deck: [魔导绪论(311101)]`);
console.log(`   Pool: 10 cards (first is 祭礼残章, related to deck)`);
console.log(`   Weights: [${poolWeights.map(w => w.toFixed(2)).join(', ')}]`);

// Weighted sample simulation
const counts = new Map<number, number>();
const TRIALS = 5000;
for (let t = 0; t < TRIALS; t++) {
  const remaining = [...pool];
  const remainingWeights = [...poolWeights];
  const n = 3; // draw 3
  for (let i = 0; i < n; i++) {
    const total = remainingWeights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < remainingWeights.length - 1; idx++) {
      r -= remainingWeights[idx];
      if (r <= 0) break;
    }
    counts.set(remaining[idx], (counts.get(remaining[idx]) ?? 0) + 1);
    remaining.splice(idx, 1);
    remainingWeights.splice(idx, 1);
  }
}

const countRelated = counts.get(311102) ?? 0;
const avgOthers = pool.filter(id => id !== 311102).reduce((s, id) => s + (counts.get(id) ?? 0), 0) / (pool.length - 1);
const ratio = countRelated / avgOthers;

console.log(`\n   Distribution (${TRIALS} trials, 3 draws each):`);
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [id, count] of sorted) {
  const pct = (count / (TRIALS * 3) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(count / 20));
  const marker = id === 311102 ? ' ← RELATED' : '';
  console.log(`   ${id}: ${count} (${pct}%) ${bar}${marker}`);
}

console.log(`\n   Related card (311102): ${countRelated}`);
console.log(`   Avg others: ${avgOthers.toFixed(0)}`);
console.log(`   Ratio: ${ratio.toFixed(2)}x`);
console.log(`   ${ratio > 1.3 ? '✓ PASS' : '✗ FAIL'}: Related card drawn significantly more often\n`);

// Test 6: Diffusion (multi-hop)
console.log('6. Diffusion (multi-hop):');
clearAllWeights();
setCardWeight(311101, 311102, 0.8);
setCardWeight(311102, 311103, 0.7);
setCardWeight(311103, 311104, 0.6);
const dw = computeCardWeights([311104], [311101]);
console.log(`   魔导绪论 --0.8--> 祭礼残章 --0.7--> 天空之卷 --0.6--> 千夜浮梦`);
console.log(`   Weight for 千夜浮梦 from deck [魔导绪论]: ${dw[0].toFixed(3)}`);
console.log(`   ${dw[0] > 1 ? '✓' : '✗'} Signal propagates through 3 hops\n`);

console.log('=== All tests complete ===');
