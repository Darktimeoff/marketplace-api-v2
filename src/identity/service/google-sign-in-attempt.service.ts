import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisClientService } from '../../generic/redis/redis-client.service.js';
import { withRedisTimeout } from '../../generic/redis/with-redis-timeout.js';
import type { GoogleSignInAttemptInterface } from '../interface/google-sign-in-attempt.interface.js';

@Injectable()
export class GoogleSignInAttemptService {
  private readonly logger = new Logger(GoogleSignInAttemptService.name);
  private readonly ttlSeconds = 600;
  private readonly timeoutMs = 300;

  constructor(private readonly redis: RedisClientService) {}

  async save(attempt: GoogleSignInAttemptInterface): Promise<void> {
    try {
      await withRedisTimeout(this.redis.queue, this.timeoutMs, () =>
        this.redis.queue.set(this.toKey(attempt.state), JSON.stringify(attempt), 'EX', this.ttlSeconds),
      );
    } catch (error) {
      this.logger.error(`google sign-in attempt could not be stored: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('Google sign-in is temporarily unavailable');
    }
  }

  private toKey(state: string): string {
    return `google-sign-in:${state}`;
  }
}
