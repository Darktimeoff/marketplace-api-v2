import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { QueryFailedError } from 'typeorm';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';
import { IdentityRepository } from '../repository/identity.repository.js';
import { IdentityExternalAccountRepository } from '../repository/identity-external-account.repository.js';
import { IdentityOutboxRepository } from '../repository/identity-outbox.repository.js';
import { IdentityMessageService } from '../service/identity-message.service.js';
import { TokenService } from '../service/token.service.js';
import { GoogleOidcClientService } from '../service/google-oidc-client.service.js';
import { GoogleSignInAttemptService } from '../service/google-sign-in-attempt.service.js';
import { IdentityProviderEnum } from '../enum/identity-provider.enum.js';
import { RoleEnum } from '../enum/role.enum.js';
import type { GoogleIdentityInterface } from '../interface/google-identity.interface.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class IdentityGoogleSignInCommandHandler {
  private readonly logger = new Logger(IdentityGoogleSignInCommandHandler.name);

  constructor(
    private readonly identities: IdentityRepository,
    private readonly externalAccounts: IdentityExternalAccountRepository,
    private readonly outbox: IdentityOutboxRepository,
    private readonly messages: IdentityMessageService,
    private readonly tokens: TokenService,
    private readonly google: GoogleOidcClientService,
    private readonly attempts: GoogleSignInAttemptService,
  ) {}

  async execute(callbackQuery: URLSearchParams, browserState: string | undefined): Promise<IdentityTokenResponseInterface> {
    const state = callbackQuery.get('state');

    if (!state || state !== browserState) {
      this.logger.warn(`google callback state does not match the browser cookie: state=${state?.slice(0, 8) ?? '-'}… cookie=${browserState?.slice(0, 8) ?? '-'}…`);
      throw new BadRequestException('Sign-in state does not match this browser');
    }

    const attempt = await this.attempts.take(state);

    if (!attempt) {
      this.logger.warn(`google callback for an unknown, expired or used state=${state.slice(0, 8)}…`);
      throw new BadRequestException('Sign-in attempt expired or was already used');
    }

    const google = await this.google.exchange(callbackQuery, attempt);

    if (!google.email || !google.emailVerified) {
      this.logger.warn(`google account sub=${google.subject} has no verified email`);
      throw new UnauthorizedException('Google account has no verified email');
    }

    try {
      return await this.signIn(google, google.email);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('An identity with this email already exists');
      }

      throw error;
    }
  }

  @Transactional()
  private async signIn(google: GoogleIdentityInterface, email: string): Promise<IdentityTokenResponseInterface> {
    const account = await this.externalAccounts.findByProviderSubject(IdentityProviderEnum.google, google.subject);

    if (account) {
      const identity = await this.identities.findById(account.identityId);

      if (!identity) {
        throw new UnauthorizedException('Google sign-in failed');
      }

      this.logger.log(`google sign-in identity=${identity.publicId} sub=${google.subject}`);
      return this.tokens.createTokenPair(identity);
    }

    if (await this.identities.findByEmail(email)) {
      this.logger.warn(`google sign-in refused: email already registered, sub=${google.subject}`);
      throw new ConflictException('An identity with this email already exists: log in with your password, then link Google');
    }

    const identity = await this.identities.create({
      email,
      loginPhone: {
        countryCode: null,
        rawNumber: null,
        fullNumber: null,
        nationalNumber: null,
      },
      passwordHash: null,
      role: RoleEnum.user,
    });

    await this.externalAccounts.create({ identityId: identity.id, provider: IdentityProviderEnum.google, subject: google.subject });
    await this.outbox.create(this.messages.toIdentityRegisteredOutbox(identity));
    this.logger.log(`google sign-up identity=${identity.publicId} sub=${google.subject}`);

    return this.tokens.createTokenPair(identity);
  }
}
