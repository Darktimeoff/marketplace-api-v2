import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as oidc from 'openid-client';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import { SecretManagerService } from '../../generic/secret-manager/secret-manager.service.js';
import type { GoogleSignInAttemptInterface } from '../interface/google-sign-in-attempt.interface.js';

@Injectable()
export class GoogleOidcClientService {
  private readonly logger = new Logger(GoogleOidcClientService.name);
  private readonly scope = 'openid email profile';
  private configuration: Promise<oidc.Configuration> | null = null;

  constructor(
    private readonly environment: EnvironmentService,
    private readonly secrets: SecretManagerService,
  ) {}

  async buildAuthorizationUrl(attempt: GoogleSignInAttemptInterface): Promise<URL> {
    return oidc.buildAuthorizationUrl(await this.getConfiguration(), {
      redirect_uri: this.environment.get('GOOGLE_REDIRECT_URI'),
      scope: this.scope,
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(attempt.codeVerifier),
      code_challenge_method: 'S256',
    });
  }

  private getConfiguration(): Promise<oidc.Configuration> {
    this.configuration ??= this.discover().catch((error: unknown) => {
      this.configuration = null;
      this.logger.error(`google discovery failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('Google sign-in is temporarily unavailable');
    });

    return this.configuration;
  }

  private async discover(): Promise<oidc.Configuration> {
    const issuer = new URL(this.environment.get('GOOGLE_ISSUER'));
    const configuration = await oidc.discovery(
      issuer,
      this.environment.get('GOOGLE_CLIENT_ID'),
      await this.secrets.get('GOOGLE_CLIENT_SECRET'),
      undefined,
      issuer.protocol === 'http:' ? { execute: [oidc.allowInsecureRequests] } : undefined,
    );
    oidc.enableNonRepudiationChecks(configuration);

    const metadata = configuration.serverMetadata();
    this.logger.log(`discovered issuer=${metadata.issuer} authorize=${metadata.authorization_endpoint} token=${metadata.token_endpoint} jwks=${metadata.jwks_uri}`);

    return configuration;
  }
}
