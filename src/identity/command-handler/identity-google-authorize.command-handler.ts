import { Injectable, Logger } from '@nestjs/common';
import * as oidc from 'openid-client';
import { GoogleOidcClientService } from '../service/google-oidc-client.service.js';
import { GoogleSignInAttemptService } from '../service/google-sign-in-attempt.service.js';
import type { GoogleSignInAttemptInterface } from '../interface/google-sign-in-attempt.interface.js';

@Injectable()
export class IdentityGoogleAuthorizeCommandHandler {
  private readonly logger = new Logger(IdentityGoogleAuthorizeCommandHandler.name);

  constructor(
    private readonly google: GoogleOidcClientService,
    private readonly attempts: GoogleSignInAttemptService,
  ) {}

  async execute(): Promise<URL> {
    const attempt: GoogleSignInAttemptInterface = {
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      codeVerifier: oidc.randomPKCECodeVerifier(),
    };
    const url = await this.google.buildAuthorizationUrl(attempt);

    await this.attempts.save(attempt);
    this.logger.log(`google sign-in started state=${attempt.state.slice(0, 8)}…`);

    return url;
  }
}
