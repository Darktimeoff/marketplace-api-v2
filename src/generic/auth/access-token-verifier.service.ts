import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { importSPKI, jwtVerify, type CryptoKey } from 'jose';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';
import { ACCESS_TOKEN_ALGORITHM, ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS, ACCESS_TOKEN_ISSUER } from './constant/access-token.constant.js';
import type { AccessTokenClaimsInterface } from './interface/access-token-claims.interface.js';
import { accessTokenPayloadSchema } from './schema/access-token-payload.schema.js';

@Injectable()
export class AccessTokenVerifierService implements OnModuleInit {
  private publicKey: CryptoKey;

  constructor(private readonly secrets: SecretManagerService) {}

  async onModuleInit(): Promise<void> {
    this.publicKey = await importSPKI(await this.secrets.get('JWT_PUBLIC_KEY'), ACCESS_TOKEN_ALGORITHM);
  }

  async verify(token: string): Promise<AccessTokenClaimsInterface> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        issuer: ACCESS_TOKEN_ISSUER,
        clockTolerance: ACCESS_TOKEN_CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      return accessTokenPayloadSchema.parse(payload);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
