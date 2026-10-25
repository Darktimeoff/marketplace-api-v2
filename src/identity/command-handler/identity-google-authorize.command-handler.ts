import { Injectable, Logger } from '@nestjs/common';
import * as oidc from 'openid-client';
import { GoogleOidcClientService } from '../service/google-oidc-client.service.js';
import { GoogleSignInAttemptService } from '../service/google-sign-in-attempt.service.js';
import type { GoogleSignInAttemptInterface } from '../interface/google-sign-in-attempt.interface.js';
import type { GoogleSignInStartInterface } from '../interface/google-sign-in-start.interface.js';

@Injectable()
export class IdentityGoogleAuthorizeCommandHandler {
  private readonly logger = new Logger(IdentityGoogleAuthorizeCommandHandler.name);

  constructor(
    private readonly google: GoogleOidcClientService,
    private readonly attempts: GoogleSignInAttemptService,
  ) {}

  async execute(linkIdentityPublicId: string | null): Promise<GoogleSignInStartInterface> {
    const attempt: GoogleSignInAttemptInterface = {
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      codeVerifier: oidc.randomPKCECodeVerifier(),
      linkIdentityPublicId,
    };
    const url = await this.google.buildAuthorizationUrl(attempt);

    await this.attempts.save(attempt);
    this.logger.log(`google ${linkIdentityPublicId ? `link for identity=${linkIdentityPublicId}` : 'sign-in'} started state=${attempt.state.slice(0, 8)}…`);

    return { url, state: attempt.state, secureCookie: this.google.isCallbackSecure() };
  }
}
