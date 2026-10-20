import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { calculateJwkThumbprint, exportJWK, importPKCS8, SignJWT, type CryptoKey } from 'jose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SecretManagerService } from '../../generic/secret-manager/secret-manager.service.js';
import { ACCESS_TOKEN_ALGORITHM, ACCESS_TOKEN_ISSUER, ACCESS_TOKEN_TTL_SECONDS } from '../../generic/auth/constant/access-token.constant.js';
import { IdentitySessionRepository } from '../repository/identity-session.repository.js';
import { JwtVerificationKeysService } from '../../generic/auth/jwt-verification-keys.service.js';
import { decodePem } from '../../generic/auth/decode-pem.js';
import type { Identity } from '../entity/identity.entity.js';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService implements OnModuleInit {
  private readonly logger = new Logger(TokenService.name);
  private privateKey: CryptoKey;
  private keyId: string;

  constructor(
    private readonly secrets: SecretManagerService,
    private readonly sessions: IdentitySessionRepository,
    private readonly verificationKeys: JwtVerificationKeysService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadSigningKey();
  }

  @Interval(60_000)
  async refreshSigningKey(): Promise<void> {
    try {
      await this.loadSigningKey();
    } catch (error) {
      this.logger.error(`jwt signing key not refreshed, keeping kid=${this.keyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  async createTokenPair(identity: Pick<Identity, 'id' | 'publicId' | 'role' | 'email' | 'loginPhone'>, familyId: string = randomUUID()): Promise<IdentityTokenResponseInterface> {
    const refreshToken = randomBytes(32).toString('base64url');
    const tokenId = randomUUID();

    await this.sessions.create({
      identityId: identity.id,
      familyId,
      tokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    const accessToken = await new SignJWT({
      role: identity.role,
      sid: familyId,
      ...(identity.email !== null && { email: identity.email }),
      ...(identity.loginPhone.fullNumber !== null && { phone_number: identity.loginPhone.fullNumber }),
    })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, kid: this.keyId, typ: 'JWT' })
      .setSubject(identity.publicId)
      .setJti(tokenId)
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.privateKey);

    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  private async loadSigningKey(): Promise<void> {
    const privateKey = await importPKCS8(decodePem(await this.secrets.get('JWT_PRIVATE_KEY')), ACCESS_TOKEN_ALGORITHM, { extractable: true });
    const keyId = await calculateJwkThumbprint(await exportJWK(privateKey));

    if (!this.verificationKeys.kids.includes(keyId)) {
      this.logger.warn(`jwt signing kid=${keyId} is not among this pod's verification keys [${this.verificationKeys.kids.join(', ')}]: add its public key to JWT_PUBLIC_KEY before signing with it`);
    }

    if (keyId !== this.keyId) {
      this.logger.log(`jwt signing key: ${keyId}`);
    }

    this.privateKey = privateKey;
    this.keyId = keyId;
  }
}
