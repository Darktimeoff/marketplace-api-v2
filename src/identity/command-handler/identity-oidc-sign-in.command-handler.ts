import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { QueryFailedError } from 'typeorm';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';
import { IdentityRepository } from '../repository/identity.repository.js';
import { IdentityExternalAccountRepository } from '../repository/identity-external-account.repository.js';
import { IdentityOutboxRepository } from '../repository/identity-outbox.repository.js';
import { IdentityMessageService } from '../service/identity-message.service.js';
import { TokenService } from '../service/token.service.js';
import { OidcClientService } from '../service/oidc-client.service.js';
import { OidcSignInAttemptService } from '../service/oidc-sign-in-attempt.service.js';
import type { IdentityProviderEnum } from '../enum/identity-provider.enum.js';
import { RoleEnum } from '../enum/role.enum.js';
import type { OidcIdentityInterface } from '../interface/oidc-identity.interface.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class IdentityOidcSignInCommandHandler {
  private readonly logger = new Logger(IdentityOidcSignInCommandHandler.name);

  constructor(
    private readonly identities: IdentityRepository,
    private readonly externalAccounts: IdentityExternalAccountRepository,
    private readonly outbox: IdentityOutboxRepository,
    private readonly messages: IdentityMessageService,
    private readonly tokens: TokenService,
    private readonly oidcClient: OidcClientService,
    private readonly attempts: OidcSignInAttemptService,
  ) {}

  async execute(provider: IdentityProviderEnum, callbackQuery: URLSearchParams, browserState: string | undefined): Promise<IdentityTokenResponseInterface> {
    const state = callbackQuery.get('state');

    if (!state || state !== browserState) {
      this.logger.warn(`${provider} callback state does not match the browser cookie: state=${state?.slice(0, 8) ?? '-'}… cookie=${browserState?.slice(0, 8) ?? '-'}…`);
      throw new BadRequestException('Sign-in state does not match this browser');
    }

    const attempt = await this.attempts.take(state);

    if (!attempt || attempt.provider !== provider) {
      this.logger.warn(`${provider} callback for an unknown, expired, used or other provider's state=${state.slice(0, 8)}…`);
      throw new BadRequestException('Sign-in attempt expired or was already used');
    }

    const external = await this.oidcClient.exchange(attempt, callbackQuery);

    if (!external.email || !external.emailVerified) {
      this.logger.warn(`${provider} account sub=${external.subject} has no verified email`);
      throw new UnauthorizedException(`${provider} account has no verified email`);
    }

    try {
      return attempt.linkIdentityPublicId
        ? await this.link(provider, external, attempt.linkIdentityPublicId)
        : await this.signIn(provider, external, external.email);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          attempt.linkIdentityPublicId ? `This identity already has a linked ${provider} account` : 'An identity with this email already exists',
        );
      }

      throw error;
    }
  }

  @Transactional()
  private async signIn(provider: IdentityProviderEnum, external: OidcIdentityInterface, email: string): Promise<IdentityTokenResponseInterface> {
    const account = await this.externalAccounts.findByProviderSubject(provider, external.subject);

    if (account) {
      const identity = await this.identities.findById(account.identityId);

      if (!identity) {
        throw new UnauthorizedException(`Sign-in with ${provider} failed`);
      }

      this.logger.log(`${provider} sign-in identity=${identity.publicId} sub=${external.subject}`);
      return this.tokens.createTokenPair(identity);
    }

    if (await this.identities.findByEmail(email)) {
      this.logger.warn(`${provider} sign-in refused: email already registered, sub=${external.subject}`);
      throw new ConflictException(`An identity with this email already exists: log in with your password, then link ${provider}`);
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

    await this.externalAccounts.create({ identityId: identity.id, provider, subject: external.subject });
    await this.outbox.create(this.messages.toIdentityRegisteredOutbox(identity));
    this.logger.log(`${provider} sign-up identity=${identity.publicId} sub=${external.subject}`);

    return this.tokens.createTokenPair(identity);
  }

  @Transactional()
  private async link(provider: IdentityProviderEnum, external: OidcIdentityInterface, identityPublicId: string): Promise<IdentityTokenResponseInterface> {
    const identity = await this.identities.findByPublicId(identityPublicId);

    if (!identity) {
      throw new UnauthorizedException(`Sign-in with ${provider} failed`);
    }

    const account = await this.externalAccounts.findByProviderSubject(provider, external.subject);

    if (account && account.identityId !== identity.id) {
      this.logger.warn(`${provider} link refused: sub=${external.subject} belongs to another identity, requested by identity=${identity.publicId}`);
      throw new ConflictException(`This ${provider} account is linked to another identity`);
    }

    if (!account) {
      await this.externalAccounts.create({ identityId: identity.id, provider, subject: external.subject });
    }

    this.logger.log(`${provider} linked identity=${identity.publicId} sub=${external.subject}`);
    return this.tokens.createTokenPair(identity);
  }
}
