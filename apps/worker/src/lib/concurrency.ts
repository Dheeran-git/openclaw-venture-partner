/**
 * Bounded concurrency runner -- the small p-limit equivalent we use in
 * the scout pipeline. Spawns up to `limit` workers that pull from a
 * shared cursor; each worker runs items sequentially. Preserves input
 * order in the output array. Errors propagate (Promise.all semantics).
 *
 * Single-threaded JS makes the cursor++ atomic between awaits, so no
 * two workers can claim the same index.
 */
export async function runConcurrent<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (limit < 1) {
    throw new Error(`runConcurrent: limit must be >= 1, got ${limit}`);
  }
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let cursor = 0;

  const runner = async (): Promise<void> => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, runner));
  return results;
}
