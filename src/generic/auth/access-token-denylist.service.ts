import { Injectable } from '@nestjs/common';
import { RedisClientService } from '../redis/redis-client.service.js';
import { ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS, ACCESS_TOKEN_TTL_SECONDS } from './constant/access-token.constant.js';

@Injectable()
export class AccessTokenDenylistService {
  private readonly deniedTtlSeconds = ACCESS_TOKEN_TTL_SECONDS + ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS;

  constructor(private readonly redis: RedisClientService) {}

  async denyFamily(familyId: string): Promise<void> {
    await this.redis.queue.set(this.toDeniedFamilyKey(familyId), '1', 'EX', this.deniedTtlSeconds);
  }

  async isFamilyDenied(familyId: string): Promise<boolean> {
    return (await this.redis.queue.exists(this.toDeniedFamilyKey(familyId))) === 1;
  }

  private toDeniedFamilyKey(familyId: string): string {
    return `denied-family:${familyId}`;
  }
}
