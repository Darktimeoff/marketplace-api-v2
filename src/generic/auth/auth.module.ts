import { Module } from '@nestjs/common';
import { SecretManagerModule } from '../secret-manager/secret-manager.module.js';
import { AccessTokenVerifierService } from './access-token-verifier.service.js';
import { AccessTokenGuard } from './access-token.guard.js';

@Module({
  imports: [SecretManagerModule],
  providers: [AccessTokenVerifierService, AccessTokenGuard],
  exports: [AccessTokenVerifierService, AccessTokenGuard],
})
export class AuthModule {}
