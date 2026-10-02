import { Injectable } from '@nestjs/common';
import { IdentitySessionRepository } from '../repository/identity-session.repository.js';
import { TokenService } from '../service/token.service.js';
import { IdentityRefreshTokenInput } from '../input/identity-refresh-token.input.js';

@Injectable()
export class IdentityLogoutCommandHandler {
  constructor(
    private readonly sessions: IdentitySessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: IdentityRefreshTokenInput): Promise<void> {
    const session = await this.sessions.findByTokenHash(this.tokens.hashRefreshToken(input.refreshToken));

    if (session) {
      await this.sessions.revokeFamily(session.familyId);
    }
  }
}
