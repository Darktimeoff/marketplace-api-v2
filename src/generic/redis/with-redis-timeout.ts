import type { Redis } from 'ioredis';

export async function withRedisTimeout<T>(redis: Redis, timeoutMs: number, command: () => Promise<T>): Promise<T> {
  if (redis.status !== 'ready') {
    throw new Error(`redis is ${redis.status}`);
  }

  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      command(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`redis did not answer in ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
