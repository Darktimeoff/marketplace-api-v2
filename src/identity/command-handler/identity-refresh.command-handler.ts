import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';
import { IdentityRepository } from '../repository/identity.repository.js';
import { IdentitySessionRepository } from '../repository/identity-session.repository.js';
import { TokenService } from '../service/token.service.js';
import { IdentityRefreshTokenInput } from '../input/identity-refresh-token.input.js';

@Injectable()
export class IdentityRefreshCommandHandler {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly sessions: IdentitySessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: IdentityRefreshTokenInput): Promise<IdentityTokenResponseInterface> {
    const tokenHash = this.tokens.hashRefreshToken(input.refreshToken);
    const rotated = await this.rotate(tokenHash);

    if (!rotated) {
      const session = await this.sessions.findByTokenHash(tokenHash);

      if (session?.usedAt) {
        await this.sessions.revokeFamily(session.familyId);
      }

      throw new UnauthorizedException('Invalid refresh token');
    }

    return rotated;
  }

  @Transactional()
  private async rotate(tokenHash: string): Promise<IdentityTokenResponseInterface | null> {
    const session = await this.sessions.consume(tokenHash);
    const identity = session ? await this.identities.findById(session.identityId) : null;

    if (!session || !identity) {
      return null;
    }

    return this.tokens.createTokenPair(identity, session.familyId);
  }
}
