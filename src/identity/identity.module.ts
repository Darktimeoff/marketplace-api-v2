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
import { AuthController } from './controller/auth.controller.js';
import { IdentityRepository } from './repository/identity.repository.js';
import { IdentitySessionRepository } from './repository/identity-session.repository.js';
import { PasswordService } from './service/password.service.js';
import { TokenService } from './service/token.service.js';
import { IdentityRegisterCommandHandler } from './command-handler/identity-register.command-handler.js';
import { IdentityLoginCommandHandler } from './command-handler/identity-login.command-handler.js';
import { IdentityRefreshCommandHandler } from './command-handler/identity-refresh.command-handler.js';
import { IdentityLogoutCommandHandler } from './command-handler/identity-logout.command-handler.js';

@Module({
  imports: [QueueModule, TypeOrmModule.forFeature([Identity, IdentitySession, IdentityOutbox, IdentityExternalAccount]), SecretManagerModule, KafkaModule, AuthModule, RateLimitModule],
  controllers: [AuthController],
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
  ],
})
export class IdentityModule {}
