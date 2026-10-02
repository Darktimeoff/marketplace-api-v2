import { Injectable, OnModuleInit } from '@nestjs/common';
import { calculateJwkThumbprint, exportJWK, importPKCS8, importSPKI, SignJWT, type CryptoKey } from 'jose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SecretManagerService } from '../../generic/secret-manager/secret-manager.service.js';
import { ACCESS_TOKEN_ALGORITHM, ACCESS_TOKEN_ISSUER, ACCESS_TOKEN_TTL_SECONDS } from '../../generic/auth/constant/access-token.constant.js';
import { IdentitySessionRepository } from '../repository/identity-session.repository.js';
import type { Identity } from '../entity/identity.entity.js';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService implements OnModuleInit {
  private privateKey: CryptoKey;
  private keyId: string;

  constructor(
    private readonly secrets: SecretManagerService,
    private readonly sessions: IdentitySessionRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    this.privateKey = await importPKCS8(await this.secrets.get('JWT_PRIVATE_KEY'), ACCESS_TOKEN_ALGORITHM);
    const publicKey = await importSPKI(await this.secrets.get('JWT_PUBLIC_KEY'), ACCESS_TOKEN_ALGORITHM, { extractable: true });
    this.keyId = await calculateJwkThumbprint(await exportJWK(publicKey));
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  async createTokenPair(identity: Pick<Identity, 'id' | 'role' | 'email' | 'loginPhone'>, familyId: string = randomUUID()): Promise<IdentityTokenResponseInterface> {
    const refreshToken = randomBytes(32).toString('base64url');

    await this.sessions.create({
      identityId: identity.id,
      familyId,
      tokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    const accessToken = await new SignJWT({
      role: identity.role,
      ...(identity.email !== null && { email: identity.email }),
      ...(identity.loginPhone.fullNumber !== null && { phone_number: identity.loginPhone.fullNumber }),
    })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, kid: this.keyId, typ: 'JWT' })
      .setSubject(String(identity.id))
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.privateKey);

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }
}
