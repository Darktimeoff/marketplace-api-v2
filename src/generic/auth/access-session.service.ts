import { Injectable } from '@nestjs/common';
import { RedisClientService } from '../redis/redis-client.service.js';
import { ACCESS_SESSION_IDLE_SECONDS, ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS, ACCESS_TOKEN_TTL_SECONDS } from './constant/access-token.constant.js';

@Injectable()
export class AccessSessionService {
  private readonly familyTtlSeconds = ACCESS_TOKEN_TTL_SECONDS + ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS;
  private readonly openScript = `
    if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    redis.call('SADD', KEYS[2], ARGV[3])
    redis.call('EXPIRE', KEYS[2], ARGV[4])
    return 1
  `;
  private readonly touchScript = `
    local familyId = redis.call('GETEX', KEYS[1], 'EX', ARGV[1])
    if not familyId then return 0 end
    if redis.call('EXISTS', ARGV[2] .. familyId) == 1 then return 0 end
    return 1
  `;
  private readonly revokeScript = `
    for _, tokenId in ipairs(redis.call('SMEMBERS', KEYS[1])) do
      redis.call('DEL', ARGV[1] .. tokenId)
    end
    redis.call('DEL', KEYS[1])
    redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
    return 1
  `;

  constructor(private readonly redis: RedisClientService) {}

  async open(tokenId: string, familyId: string): Promise<boolean> {
    const opened = await this.redis.queue.eval(
      this.openScript,
      3,
      this.toSessionKey(tokenId),
      this.toFamilyKey(familyId),
      this.toRevokedFamilyKey(familyId),
      familyId,
      ACCESS_SESSION_IDLE_SECONDS,
      tokenId,
      this.familyTtlSeconds,
    );
    return opened === 1;
  }

  async touch(tokenId: string): Promise<boolean> {
    return (await this.redis.queue.eval(this.touchScript, 1, this.toSessionKey(tokenId), ACCESS_SESSION_IDLE_SECONDS, this.toRevokedFamilyKey(''))) === 1;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.redis.queue.eval(this.revokeScript, 2, this.toFamilyKey(familyId), this.toRevokedFamilyKey(familyId), this.toSessionKey(''), this.familyTtlSeconds);
  }

  private toSessionKey(tokenId: string): string {
    return `session:${tokenId}`;
  }

  private toFamilyKey(familyId: string): string {
    return `session-family:${familyId}`;
  }

  private toRevokedFamilyKey(familyId: string): string {
    return `session-family-revoked:${familyId}`;
  }
}
