import { SetMetadata } from '@nestjs/common';
import type { CacheEntryOptionsInterface } from '../cache-entry-options.interface.js';

export const CACHEABLE_METADATA = 'cache:cacheable';

export interface CacheableOptionsInterface<A extends unknown[] = never[]> extends CacheEntryOptionsInterface {
  key: (...args: A) => string;
}

export const Cacheable = <A extends unknown[]>(options: CacheableOptionsInterface<A>) => SetMetadata(CACHEABLE_METADATA, options);
