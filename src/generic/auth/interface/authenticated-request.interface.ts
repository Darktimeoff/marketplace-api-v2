import type { AccessTokenClaimsInterface } from './access-token-claims.interface.js';

export interface AuthenticatedRequestInterface {
  headers: { authorization?: string };
  identity?: AccessTokenClaimsInterface;
}
