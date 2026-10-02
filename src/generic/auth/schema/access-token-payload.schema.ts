import * as z from 'zod';
import { RoleEnum } from '../../../identity/enum/role.enum.js';
import type { AccessTokenClaimsInterface } from '../interface/access-token-claims.interface.js';

export const accessTokenPayloadSchema = z
  .object({
    sub: z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().max(Number.MAX_SAFE_INTEGER)),
    role: z.enum(RoleEnum),
    email: z.string().optional(),
    phone_number: z.string().optional(),
  })
  .transform((payload): AccessTokenClaimsInterface => ({
    identityId: payload.sub,
    role: payload.role,
    email: payload.email ?? null,
    phoneNumber: payload.phone_number ?? null,
  }));
