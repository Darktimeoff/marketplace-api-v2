import type { IdentityProviderEnum } from '../enum/identity-provider.enum.js';

export interface OidcSignInAttemptInterface {
  provider: IdentityProviderEnum;
  state: string;
  nonce: string;
  codeVerifier: string;
  linkIdentityPublicId: string | null;
}
