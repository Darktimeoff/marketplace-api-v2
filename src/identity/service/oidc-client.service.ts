import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as oidc from 'openid-client';
import { EnvironmentService } from '../../generic/environment/environment.module.js';
import { SecretManagerService } from '../../generic/secret-manager/secret-manager.service.js';
import { IdentityProviderEnum } from '../enum/identity-provider.enum.js';
import { OIDC_PROVIDERS } from '../constant/oidc-provider.constant.js';
import type { OidcSignInAttemptInterface } from '../interface/oidc-sign-in-attempt.interface.js';
import type { OidcIdentityInterface } from '../interface/oidc-identity.interface.js';

@Injectable()
export class OidcClientService {
  private readonly logger = new Logger(OidcClientService.name);
  private readonly configurations = new Map<IdentityProviderEnum, Promise<oidc.Configuration>>();

  constructor(
    private readonly environment: EnvironmentService,
    private readonly secrets: SecretManagerService,
  ) {}

  async buildAuthorizationUrl(attempt: OidcSignInAttemptInterface): Promise<URL> {
    return oidc.buildAuthorizationUrl(await this.getConfiguration(attempt.provider), {
      redirect_uri: this.toCallbackUrl(attempt.provider).href,
      scope: OIDC_PROVIDERS[attempt.provider].scope,
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(attempt.codeVerifier),
      code_challenge_method: 'S256',
    });
  }

  isCallbackSecure(): boolean {
    return new URL(this.environment.get('OIDC_REDIRECT_BASE_URL')).protocol === 'https:';
  }

  async exchange(attempt: OidcSignInAttemptInterface, callbackQuery: URLSearchParams): Promise<OidcIdentityInterface> {
    const callbackUrl = this.toCallbackUrl(attempt.provider);
    callbackUrl.search = callbackQuery.toString();

    try {
      const tokens = await oidc.authorizationCodeGrant(await this.getConfiguration(attempt.provider), callbackUrl, {
        pkceCodeVerifier: attempt.codeVerifier,
        expectedState: attempt.state,
        expectedNonce: attempt.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();

      if (!claims) {
        throw new UnauthorizedException(`Sign-in with ${attempt.provider} failed`);
      }

      const header = JSON.parse(Buffer.from(tokens.id_token!.split('.')[0], 'base64url').toString()) as { alg: string; kid: string };
      this.logger.debug(`${attempt.provider} token response token_type=${tokens.token_type} expires_in=${tokens.expires_in} scope="${tokens.scope}" id_token alg=${header.alg} kid=${header.kid}`);
      this.logger.debug(`${attempt.provider} id_token claims iss=${claims.iss} aud=${String(claims.aud)} sub=${claims.sub} email_verified=${String(claims.email_verified)} exp=${new Date(claims.exp * 1000).toISOString()}`);

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
        this.logger.warn(`${attempt.provider} sign-in rejected: ${error.name} ${'code' in error ? String(error.code) : ''} ${'error' in error ? String(error.error) : ''} ${error.message}`);
        throw new UnauthorizedException(`Sign-in with ${attempt.provider} failed`);
      }

      this.logger.error(`${attempt.provider} token exchange failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('External sign-in is temporarily unavailable');
    }
  }

  private toCallbackUrl(provider: IdentityProviderEnum): URL {
    return new URL(`/auth/${provider}/callback`, this.environment.get('OIDC_REDIRECT_BASE_URL'));
  }

  private getConfiguration(provider: IdentityProviderEnum): Promise<oidc.Configuration> {
    let configuration = this.configurations.get(provider);

    if (!configuration) {
      configuration = this.discover(provider).catch((error: unknown) => {
        this.configurations.delete(provider);
        this.logger.error(`${provider} discovery failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new ServiceUnavailableException('External sign-in is temporarily unavailable');
      });
      this.configurations.set(provider, configuration);
    }

    return configuration;
  }

  private async discover(provider: IdentityProviderEnum): Promise<oidc.Configuration> {
    const config = OIDC_PROVIDERS[provider];
    const issuer = new URL(this.environment.get(config.issuerVariable));
    const configuration = await oidc.discovery(
      issuer,
      this.environment.get(config.clientIdVariable),
      await this.secrets.get(config.clientSecretName),
      undefined,
      issuer.protocol === 'http:' ? { execute: [oidc.allowInsecureRequests] } : undefined,
    );
    oidc.enableNonRepudiationChecks(configuration);

    const metadata = configuration.serverMetadata();
    this.logger.log(`${provider} discovered issuer=${metadata.issuer} authorize=${metadata.authorization_endpoint} token=${metadata.token_endpoint} jwks=${metadata.jwks_uri}`);

    return configuration;
  }
}
