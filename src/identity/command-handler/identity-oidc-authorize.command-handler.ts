import { Injectable, Logger } from '@nestjs/common';
import * as oidc from 'openid-client';
import { OidcClientService } from '../service/oidc-client.service.js';
import { OidcSignInAttemptService } from '../service/oidc-sign-in-attempt.service.js';
import type { IdentityProviderEnum } from '../enum/identity-provider.enum.js';
import type { OidcSignInAttemptInterface } from '../interface/oidc-sign-in-attempt.interface.js';
import type { OidcSignInStartInterface } from '../interface/oidc-sign-in-start.interface.js';

@Injectable()
export class IdentityOidcAuthorizeCommandHandler {
  private readonly logger = new Logger(IdentityOidcAuthorizeCommandHandler.name);

  constructor(
    private readonly oidcClient: OidcClientService,
    private readonly attempts: OidcSignInAttemptService,
  ) {}

  async execute(provider: IdentityProviderEnum, linkIdentityPublicId: string | null): Promise<OidcSignInStartInterface> {
    const attempt: OidcSignInAttemptInterface = {
      provider,
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      codeVerifier: oidc.randomPKCECodeVerifier(),
      linkIdentityPublicId,
    };
    const url = await this.oidcClient.buildAuthorizationUrl(attempt);

    await this.attempts.save(attempt);
    this.logger.log(`${provider} ${linkIdentityPublicId ? `link for identity=${linkIdentityPublicId}` : 'sign-in'} started state=${attempt.state.slice(0, 8)}…`);

    return { url, state: attempt.state, secureCookie: this.oidcClient.isCallbackSecure() };
  }
}
