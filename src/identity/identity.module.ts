import { QueueModule } from '../generic/queue/queue.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Identity } from './entity/identity.entity.js';
import { IdentitySession } from './entity/identity-session.entity.js';
import { IdentityOutbox } from './entity/identity-outbox.entity.js';
import { IdentityExternalAccount } from './entity/identity-external-account.entity.js';
import { IdentityOutboxRepository } from './repository/identity-outbox.repository.js';
import { IdentityOutboxRelayService } from './service/identity-outbox-relay.service.js';
import { IdentityMessageService } from './service/identity-message.service.js';
import { SecretManagerModule } from '../generic/secret-manager/secret-manager.module.js';
import { AuthModule } from '../generic/auth/auth.module.js';
import { RateLimitModule } from '../generic/rate-limit/rate-limit.module.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { RedisModule } from '../generic/redis/redis.module.js';
import { AuthController } from './controller/auth.controller.js';
import { JwksController } from './controller/jwks.controller.js';
import { OidcController } from './controller/oidc.controller.js';
import { IdentityRepository } from './repository/identity.repository.js';
import { IdentitySessionRepository } from './repository/identity-session.repository.js';
import { PasswordService } from './service/password.service.js';
import { TokenService } from './service/token.service.js';
import { IdentityRegisterCommandHandler } from './command-handler/identity-register.command-handler.js';
import { IdentityLoginCommandHandler } from './command-handler/identity-login.command-handler.js';
import { IdentityRefreshCommandHandler } from './command-handler/identity-refresh.command-handler.js';
import { IdentityLogoutCommandHandler } from './command-handler/identity-logout.command-handler.js';
import { IdentityOidcAuthorizeCommandHandler } from './command-handler/identity-oidc-authorize.command-handler.js';
import { OidcClientService } from './service/oidc-client.service.js';
import { OidcSignInAttemptService } from './service/oidc-sign-in-attempt.service.js';
import { IdentityOidcSignInCommandHandler } from './command-handler/identity-oidc-sign-in.command-handler.js';
import { IdentityExternalAccountRepository } from './repository/identity-external-account.repository.js';
import { IdentityOidcLinkCommandHandler } from './command-handler/identity-oidc-link.command-handler.js';

@Module({
  imports: [QueueModule, TypeOrmModule.forFeature([Identity, IdentitySession, IdentityOutbox, IdentityExternalAccount]), SecretManagerModule, KafkaModule, AuthModule, RateLimitModule, RedisModule],
  controllers: [AuthController, OidcController, JwksController],
  providers: [
    IdentityRepository,
    IdentitySessionRepository,
    IdentityOutboxRepository,
    IdentityOutboxRelayService,
    IdentityMessageService,
    PasswordService,
    TokenService,
    IdentityRegisterCommandHandler,
    IdentityLoginCommandHandler,
    IdentityRefreshCommandHandler,
    IdentityLogoutCommandHandler,
    IdentityOidcAuthorizeCommandHandler,
    OidcClientService,
    OidcSignInAttemptService,
    IdentityOidcSignInCommandHandler,
    IdentityExternalAccountRepository,
    IdentityOidcLinkCommandHandler,
  ],
})
export class IdentityModule {}
