import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { IdentityRepository } from '../repository/identity.repository.js';
import { PasswordService } from '../service/password.service.js';
import { IdentityOidcAuthorizeCommandHandler } from './identity-oidc-authorize.command-handler.js';
import { IdentityOidcLinkInput } from '../input/identity-oidc-link.input.js';
import type { IdentityProviderEnum } from '../enum/identity-provider.enum.js';
import type { OidcSignInStartInterface } from '../interface/oidc-sign-in-start.interface.js';

@Injectable()
export class IdentityOidcLinkCommandHandler {
  private readonly logger = new Logger(IdentityOidcLinkCommandHandler.name);

  constructor(
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly authorize: IdentityOidcAuthorizeCommandHandler,
  ) {}

  async execute(provider: IdentityProviderEnum, identityPublicId: string, input: IdentityOidcLinkInput): Promise<OidcSignInStartInterface> {
    const identity = await this.identities.findByPublicId(identityPublicId);

    if (!(await this.passwords.verify(identity?.passwordHash ?? null, input.password)) || !identity) {
      this.logger.warn(`${provider} link refused: password confirmation failed for identity=${identityPublicId}`);
      throw new ForbiddenException('Password confirmation failed');
    }

    return this.authorize.execute(provider, identity.publicId);
  }
}
