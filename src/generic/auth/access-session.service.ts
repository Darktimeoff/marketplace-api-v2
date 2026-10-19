import { Injectable } from '@nestjs/common';
import { RedisClientService } from '../redis/redis-client.service.js';
import { ACCESS_SESSION_IDLE_SECONDS, ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS, ACCESS_TOKEN_TTL_SECONDS } from './constant/access-token.constant.js';

@Injectable()
export class AccessSessionService {
  private readonly familyTtlSeconds = ACCESS_TOKEN_TTL_SECONDS + ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS;

  constructor(private readonly redis: RedisClientService) {}

  async open(tokenId: string, familyId: string): Promise<void> {
    await this.redis.queue
      .multi()
      .set(this.toSessionKey(tokenId), familyId, 'EX', ACCESS_SESSION_IDLE_SECONDS)
      .sadd(this.toFamilyKey(familyId), tokenId)
      .expire(this.toFamilyKey(familyId), this.familyTtlSeconds)
      .exec();
  }

  async touch(tokenId: string): Promise<boolean> {
    return (await this.redis.queue.getex(this.toSessionKey(tokenId), 'EX', ACCESS_SESSION_IDLE_SECONDS)) !== null;
  }

  async revokeFamily(familyId: string): Promise<void> {
    const tokenIds = await this.redis.queue.smembers(this.toFamilyKey(familyId));
    await this.redis.queue.del(this.toFamilyKey(familyId), ...tokenIds.map((tokenId) => this.toSessionKey(tokenId)));
  }

  private toSessionKey(tokenId: string): string {
    return `session:${tokenId}`;
  }

  private toFamilyKey(familyId: string): string {
    return `session-family:${familyId}`;
  }
}
