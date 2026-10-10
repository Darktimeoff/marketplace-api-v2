import * as z from 'zod';
import { RoleEnum } from '../../../identity/enum/role.enum.js';
import type { AccessTokenClaimsInterface } from '../interface/access-token-claims.interface.js';

export const accessTokenPayloadSchema = z
  .object({
    sub: z.uuid(),
    role: z.enum(RoleEnum),
    email: z.string().optional(),
    phone_number: z.string().optional(),
  })
  .transform((payload): AccessTokenClaimsInterface => ({
    identityPublicId: payload.sub,
    role: payload.role,
    email: payload.email ?? null,
    phoneNumber: payload.phone_number ?? null,
  }));
