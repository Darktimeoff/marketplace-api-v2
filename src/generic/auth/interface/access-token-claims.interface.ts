import type { RoleEnum } from '../../../identity/enum/role.enum.js';

export interface AccessTokenClaimsInterface {
  identityId: number;
  role: RoleEnum;
  email: string | null;
  phoneNumber: string | null;
}
