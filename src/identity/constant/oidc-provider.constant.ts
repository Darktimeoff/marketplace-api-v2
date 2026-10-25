import { IdentityProviderEnum } from '../enum/identity-provider.enum.js';
import type { OidcProviderConfigInterface } from '../interface/oidc-provider-config.interface.js';

export const OIDC_PROVIDERS: Record<IdentityProviderEnum, OidcProviderConfigInterface> = {
  [IdentityProviderEnum.google]: {
    issuerVariable: 'GOOGLE_ISSUER',
    clientIdVariable: 'GOOGLE_CLIENT_ID',
    clientSecretName: 'GOOGLE_CLIENT_SECRET',
    scope: 'openid email profile',
  },
};
