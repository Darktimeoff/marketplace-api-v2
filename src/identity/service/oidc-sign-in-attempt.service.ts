import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisClientService } from '../../generic/redis/redis-client.service.js';
import { withRedisTimeout } from '../../generic/redis/with-redis-timeout.js';
import type { OidcSignInAttemptInterface } from '../interface/oidc-sign-in-attempt.interface.js';
import { OIDC_SIGN_IN_TTL_SECONDS } from '../constant/oidc-sign-in.constant.js';

@Injectable()
export class OidcSignInAttemptService {
  private readonly logger = new Logger(OidcSignInAttemptService.name);
  private readonly timeoutMs = 300;

  constructor(private readonly redis: RedisClientService) {}

  async save(attempt: OidcSignInAttemptInterface): Promise<void> {
    try {
      await withRedisTimeout(this.redis.queue, this.timeoutMs, () =>
        this.redis.queue.set(this.toKey(attempt.state), JSON.stringify(attempt), 'EX', OIDC_SIGN_IN_TTL_SECONDS),
      );
    } catch (error) {
      this.logger.error(`oidc sign-in attempt could not be stored: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('External sign-in is temporarily unavailable');
    }
  }

  async take(state: string): Promise<OidcSignInAttemptInterface | null> {
    try {
      const stored = await withRedisTimeout(this.redis.queue, this.timeoutMs, () => this.redis.queue.getdel(this.toKey(state)));
      return stored === null ? null : (JSON.parse(stored) as OidcSignInAttemptInterface);
    } catch (error) {
      this.logger.error(`oidc sign-in attempt could not be read: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('External sign-in is temporarily unavailable');
    }
  }

  private toKey(state: string): string {
    return `oidc-sign-in:${state}`;
  }
}
