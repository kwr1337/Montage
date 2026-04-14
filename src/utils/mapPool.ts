/**
 * Выполняет async-обработку элементов с ограничением параллелизма
 * (меньше одновременных HTTP-запросов на медленных сетях).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  iterator: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const cap = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await iterator(items[i], i);
    }
  };

  const workers = Array.from({ length: Math.min(cap, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
