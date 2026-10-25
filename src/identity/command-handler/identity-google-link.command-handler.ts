import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { IdentityRepository } from '../repository/identity.repository.js';
import { PasswordService } from '../service/password.service.js';
import { IdentityGoogleAuthorizeCommandHandler } from './identity-google-authorize.command-handler.js';
import { IdentityGoogleLinkInput } from '../input/identity-google-link.input.js';
import type { GoogleSignInStartInterface } from '../interface/google-sign-in-start.interface.js';

@Injectable()
export class IdentityGoogleLinkCommandHandler {
  private readonly logger = new Logger(IdentityGoogleLinkCommandHandler.name);

  constructor(
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly authorize: IdentityGoogleAuthorizeCommandHandler,
  ) {}

  async execute(identityPublicId: string, input: IdentityGoogleLinkInput): Promise<GoogleSignInStartInterface> {
    const identity = await this.identities.findByPublicId(identityPublicId);

    if (!(await this.passwords.verify(identity?.passwordHash ?? null, input.password)) || !identity) {
      this.logger.warn(`google link refused: password confirmation failed for identity=${identityPublicId}`);
      throw new ForbiddenException('Password confirmation failed');
    }

    return this.authorize.execute(identity.publicId);
  }
}
