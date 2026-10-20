import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { AccessTokenVerifierService } from './access-token-verifier.service.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { RedisModule } from '../redis/redis.module.js';
import { AccessTokenDenylistService } from './access-token-denylist.service.js';
import { JwtVerificationKeysService } from './jwt-verification-keys.service.js';

@Module({
  imports: [SecretManagerModule, RedisModule],
  providers: [AccessTokenVerifierService, AccessTokenGuard, AccessTokenDenylistService, JwtVerificationKeysService],
  exports: [AccessTokenVerifierService, AccessTokenGuard, AccessTokenDenylistService, JwtVerificationKeysService],
})
export class AuthModule {}
