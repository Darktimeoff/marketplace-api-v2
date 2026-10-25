import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { IdentitySessionRepository } from '../repository/identity-session.repository.js';
import { TokenService } from '../service/token.service.js';
import { IdentityRefreshTokenInput } from '../input/identity-refresh-token.input.js';
import { AccessTokenDenylistService } from '../../generic/auth/access-token-denylist.service.js';

@Injectable()
export class IdentityLogoutCommandHandler {
  constructor(
    private readonly sessions: IdentitySessionRepository,
    private readonly tokens: TokenService,
    private readonly denylist: AccessTokenDenylistService,
  ) {}

  async execute(input: IdentityRefreshTokenInput): Promise<void> {
    const session = await this.sessions.findByTokenHash(this.tokens.hashRefreshToken(input.refreshToken));

    if (session) {
      await this.revokeFamily(session.familyId);
      await this.denylist.denyFamily(session.familyId);
    }
  }

  @Transactional()
  private async revokeFamily(familyId: string): Promise<void> {
    await this.sessions.lockFamily(familyId);
    await this.sessions.revokeFamily(familyId);
  }
}
