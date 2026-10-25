import { SetMetadata } from '@nestjs/common';

export const CACHE_EVICT_METADATA = 'cache:evict';

export interface CacheEvictOptionsInterface<A extends unknown[] = never[]> {
  key: (...args: A) => string;
}

export const CacheEvict = <A extends unknown[]>(options: CacheEvictOptionsInterface<A>) => SetMetadata(CACHE_EVICT_METADATA, options);
