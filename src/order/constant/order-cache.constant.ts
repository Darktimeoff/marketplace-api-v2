export const ORDER_CACHE_TTL_SECONDS = 300;
export const ORDER_CACHE_JITTER_SECONDS = 60;
export const orderCacheKey = (id: number): string => `order:${id}`;
