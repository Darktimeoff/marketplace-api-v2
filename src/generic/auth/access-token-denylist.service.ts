import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisClientService } from '../redis/redis-client.service.js';
import { EnvironmentService } from '../environment/environment.module.js';
import { ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS, ACCESS_TOKEN_TTL_SECONDS } from './constant/access-token.constant.js';

@Injectable()
export class AccessTokenDenylistService {
  private readonly logger = new Logger(AccessTokenDenylistService.name);
  private readonly deniedTtlSeconds = ACCESS_TOKEN_TTL_SECONDS + ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS;
  private readonly timeoutMs = 300;
  private readonly failOpen: boolean;

  constructor(
    private readonly redis: RedisClientService,
    environment: EnvironmentService,
  ) {
    this.failOpen = environment.get('ACCESS_DENYLIST_FAIL_OPEN');
  }

  async denyFamily(familyId: string): Promise<void> {
    try {
      await this.withTimeout(() => this.redis.queue.set(this.toDeniedFamilyKey(familyId), '1', 'EX', this.deniedTtlSeconds));
    } catch (error) {
      if (!this.failOpen) {
        throw new ServiceUnavailableException('Access token revocation could not be recorded');
      }

      this.logger.error(`denylist unavailable, family=${familyId} stays usable until its access tokens expire: ${this.toMessage(error)}`);
    }
  }

  async isFamilyDenied(familyId: string): Promise<boolean> {
    try {
      return (await this.withTimeout(() => this.redis.queue.exists(this.toDeniedFamilyKey(familyId)))) === 1;
    } catch (error) {
      if (!this.failOpen) {
        throw new ServiceUnavailableException('Access token revocation check unavailable');
      }

      this.logger.warn(`denylist unavailable, accepting the token on its signature: ${this.toMessage(error)}`);
      return false;
    }
  }

  private async withTimeout<T>(command: () => Promise<T>): Promise<T> {
    if (this.redis.queue.status !== 'ready') {
      throw new Error(`redis is ${this.redis.queue.status}`);
    }

    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        command(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`redis did not answer in ${this.timeoutMs} ms`)), this.timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private toDeniedFamilyKey(familyId: string): string {
    return `denied-family:${familyId}`;
  }
}
