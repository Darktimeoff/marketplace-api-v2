import { Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtVerify } from 'jose';
import { JwtVerificationKeysService } from './jwt-verification-keys.service.js';
import { ACCESS_TOKEN_ALGORITHM, ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS, ACCESS_TOKEN_ISSUER } from './constant/access-token.constant.js';
import type { AccessTokenClaimsInterface } from './interface/access-token-claims.interface.js';
import { accessTokenPayloadSchema } from './schema/access-token-payload.schema.js';
import { AccessTokenDenylistService } from './access-token-denylist.service.js';

@Injectable()
export class AccessTokenVerifierService {
  constructor(
    private readonly keys: JwtVerificationKeysService,
    private readonly denylist: AccessTokenDenylistService,
  ) {}

  async verify(token: string): Promise<AccessTokenClaimsInterface> {
    const claims = await this.verifySignature(token);

    if (await this.denylist.isFamilyDenied(claims.familyId)) {
      throw new UnauthorizedException('Access token revoked');
    }

    return claims;
  }

  private async verifySignature(token: string): Promise<AccessTokenClaimsInterface> {
    try {
      const { payload } = await jwtVerify(token, this.keys.getKey, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        issuer: ACCESS_TOKEN_ISSUER,
        clockTolerance: ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ['sub', 'exp', 'iat', 'jti', 'sid'],
      });
      return accessTokenPayloadSchema.parse(payload);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
