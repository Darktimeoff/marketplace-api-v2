import type { RoleEnum } from '../../../identity/enum/role.enum.js';

export interface AccessTokenClaimsInterface {
  identityPublicId: string;
  role: RoleEnum;
  email: string | null;
  phoneNumber: string | null;
}
