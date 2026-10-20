import type { AccessTokenClaimsInterface } from './access-token-claims.interface.js';
import type { AppAbilityType } from '../app-ability.type.js';

export interface AuthenticatedRequestInterface {
  headers: { authorization?: string };
  identity?: AccessTokenClaimsInterface;
  ability?: AppAbilityType;
}
