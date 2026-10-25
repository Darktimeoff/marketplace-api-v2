export function testWorkers(): number {
  return Math.max(1, Number(process.env.TEST_WORKERS ?? 4));
}
