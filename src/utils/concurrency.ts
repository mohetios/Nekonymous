export const mapBounded = async <T, R>(
  items: readonly T[],
  limit: number,
  mapItem: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Concurrency limit must be a positive integer");
  }
  if (items.length === 0) {
    return [];
  }

  const results: R[] = [];
  const entries = items.entries();
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const entry = entries.next();
        if (entry.done) {
          return;
        }
        const [index, item] = entry.value;
        results[index] = await mapItem(item, index);
      }
    })
  );

  return results;
};
