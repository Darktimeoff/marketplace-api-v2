import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';
import { IdentityRepository } from '../repository/identity.repository.js';
import { IdentitySessionRepository } from '../repository/identity-session.repository.js';
import { TokenService } from '../service/token.service.js';
import { IdentityRefreshTokenInput } from '../input/identity-refresh-token.input.js';
import { AccessTokenDenylistService } from '../../generic/auth/access-token-denylist.service.js';

@Injectable()
export class IdentityRefreshCommandHandler {
  private readonly logger = new Logger(IdentityRefreshCommandHandler.name);

  constructor(
    private readonly identities: IdentityRepository,
    private readonly sessions: IdentitySessionRepository,
    private readonly tokens: TokenService,
    private readonly denylist: AccessTokenDenylistService,
  ) {}

  async execute(input: IdentityRefreshTokenInput): Promise<IdentityTokenResponseInterface> {
    const tokenHash = this.tokens.hashRefreshToken(input.refreshToken);
    const rotated = await this.rotate(tokenHash);

    if (!rotated) {
      const session = await this.sessions.findByTokenHash(tokenHash);

      if (session?.usedAt) {
        this.logger.warn(`refresh token reuse detected: revoking family=${session.familyId} identity=${session.identityId}`);
        await this.revokeFamily(session.familyId);
        await this.denylist.denyFamily(session.familyId);
      }

      throw new UnauthorizedException('Invalid refresh token');
    }

    return rotated;
  }

  @Transactional()
  private async rotate(tokenHash: string): Promise<IdentityTokenResponseInterface | null> {
    const presented = await this.sessions.findByTokenHash(tokenHash);

    if (!presented) {
      return null;
    }

    await this.sessions.lockFamily(presented.familyId);
    const session = await this.sessions.consume(tokenHash);
    const identity = session ? await this.identities.findById(session.identityId) : null;

    if (!session || !identity) {
      return null;
    }

    return this.tokens.createTokenPair(identity, session.familyId);
  }

  @Transactional()
  private async revokeFamily(familyId: string): Promise<void> {
    await this.sessions.lockFamily(familyId);
    await this.sessions.revokeFamily(familyId);
  }
}
