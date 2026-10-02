import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Identity } from './entity/identity.entity.js';
import { IdentitySession } from './entity/identity-session.entity.js';
import { SecretManagerModule } from '../generic/secret-manager/secret-manager.module.js';
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
  imports: [TypeOrmModule.forFeature([Identity, IdentitySession]), SecretManagerModule],
  controllers: [AuthController],
  providers: [
    IdentityRepository,
    IdentitySessionRepository,
    PasswordService,
    TokenService,
    IdentityRegisterCommandHandler,
    IdentityLoginCommandHandler,
    IdentityRefreshCommandHandler,
    IdentityLogoutCommandHandler,
  ],
})
export class IdentityModule {}
