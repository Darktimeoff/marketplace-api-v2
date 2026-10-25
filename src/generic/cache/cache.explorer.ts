import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { CacheService } from './cache.service.js';
import { CACHEABLE_METADATA, type CacheableOptionsInterface } from './decorator/cacheable.decorator.js';
import { CACHE_EVICT_METADATA, type CacheEvictOptionsInterface } from './decorator/cache-evict.decorator.js';

type MethodType = (...args: unknown[]) => Promise<unknown>;

@Injectable()
export class CacheExplorer implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;

      if (!wrapper.isDependencyTreeStatic() || typeof instance !== 'object' || instance === null) {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance);

      for (const name of this.scanner.getAllMethodNames(prototype)) {
        this.wrap(instance as Record<string, MethodType>, name, prototype[name]);
      }
    }
  }

  private wrap(instance: Record<string, MethodType>, name: string, method: MethodType): void {
    const cacheable = this.reflector.get<CacheableOptionsInterface<unknown[]> | undefined>(CACHEABLE_METADATA, method);
    const evict = this.reflector.get<CacheEvictOptionsInterface<unknown[]> | undefined>(CACHE_EVICT_METADATA, method);
    const cache = this.cache;

    if (cacheable) {
      instance[name] = function (this: unknown, ...args: unknown[]) {
        return cache.getOrLoad(cacheable.key(...args), cacheable, () => method.apply(this, args));
      };
    }

    if (evict) {
      instance[name] = async function (this: unknown, ...args: unknown[]) {
        const result = await method.apply(this, args);
        await cache.delete(evict.key(...args));
        return result;
      };
    }
  }
}
