
const ITERATIONS = 1000;

function baseline() {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    // Simulate 10 sequential calls (N+1 overhead)
    for (let j = 0; j < 10; j++) {
      // Dummy logic to represent overhead
      Math.sqrt(j);
    }
  }
  return performance.now() - start;
}

function optimized() {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    // Simulate 1 setup call (bulk/pre-populated)
    Math.sqrt(10);
  }
  return performance.now() - start;
}

const bTime = baseline();
const oTime = optimized();

console.log(`Baseline (${ITERATIONS} iterations): ${bTime.toFixed(4)}ms`);
console.log(`Optimized (${ITERATIONS} iterations): ${oTime.toFixed(4)}ms`);
console.log(`Improvement: ${((bTime - oTime) / bTime * 100).toFixed(2)}%`);
