import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { AccessTokenVerifierService } from './access-token-verifier.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { RedisModule } from '../redis/redis.module.js';
import { AccessSessionService } from './access-session.service.js';

@Module({
  imports: [SecretManagerModule, RedisModule],
  providers: [AccessTokenVerifierService, AccessTokenGuard, AccessSessionService],
  exports: [AccessTokenVerifierService, AccessTokenGuard, AccessSessionService],
})
export class AuthModule {}
