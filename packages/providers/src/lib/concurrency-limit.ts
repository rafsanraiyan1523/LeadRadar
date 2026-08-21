/**
 * Minimal concurrency limiter: at most `maxConcurrent` functions passed to
 * the returned limiter run at once; the rest queue in call order. Used to
 * cap simultaneous outbound calls to a paid provider (MAX_CONCURRENT_REQUESTS).
 */
export function createConcurrencyLimit(maxConcurrent: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= maxConcurrent || queue.length === 0) {
      return;
    }
    active++;
    const run = queue.shift();
    run?.();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
