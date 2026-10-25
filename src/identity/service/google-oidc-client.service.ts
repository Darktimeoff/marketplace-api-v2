import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as oidc from 'openid-client';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import { SecretManagerService } from '../../generic/secret-manager/secret-manager.service.js';
import type { GoogleSignInAttemptInterface } from '../interface/google-sign-in-attempt.interface.js';
import type { GoogleIdentityInterface } from '../interface/google-identity.interface.js';

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

  isCallbackSecure(): boolean {
    return new URL(this.environment.get('GOOGLE_REDIRECT_URI')).protocol === 'https:';
  }

  async exchange(callbackQuery: URLSearchParams, attempt: GoogleSignInAttemptInterface): Promise<GoogleIdentityInterface> {
    const callbackUrl = new URL(this.environment.get('GOOGLE_REDIRECT_URI'));
    callbackUrl.search = callbackQuery.toString();

    try {
      const tokens = await oidc.authorizationCodeGrant(await this.getConfiguration(), callbackUrl, {
        pkceCodeVerifier: attempt.codeVerifier,
        expectedState: attempt.state,
        expectedNonce: attempt.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();

      if (!claims) {
        throw new UnauthorizedException('Google sign-in failed');
      }

      const header = JSON.parse(Buffer.from(tokens.id_token!.split('.')[0], 'base64url').toString()) as { alg: string; kid: string };
      this.logger.debug(`token response token_type=${tokens.token_type} expires_in=${tokens.expires_in} scope="${tokens.scope}" id_token alg=${header.alg} kid=${header.kid}`);
      this.logger.debug(`id_token claims iss=${claims.iss} aud=${String(claims.aud)} sub=${claims.sub} email_verified=${String(claims.email_verified)} exp=${new Date(claims.exp * 1000).toISOString()}`);

      return {
        subject: claims.sub,
        email: typeof claims.email === 'string' ? claims.email : null,
        emailVerified: claims.email_verified === true,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (error instanceof oidc.ResponseBodyError || error instanceof oidc.AuthorizationResponseError || error instanceof oidc.ClientError) {
        this.logger.warn(`google sign-in rejected: ${error.name} ${'code' in error ? String(error.code) : ''} ${'error' in error ? String(error.error) : ''} ${error.message}`);
        throw new UnauthorizedException('Google sign-in failed');
      }

      this.logger.error(`google token exchange failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('Google sign-in is temporarily unavailable');
    }
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
