import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';
import { IdentityRepository } from '../repository/identity.repository.js';
import { PasswordService } from '../service/password.service.js';
import { TokenService } from '../service/token.service.js';
import { IdentityLoginInput } from '../input/identity-login.input.js';

@Injectable()
export class IdentityLoginCommandHandler {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: IdentityLoginInput): Promise<IdentityTokenResponseInterface> {
    const identity = input.login.startsWith('+')
      ? await this.identities.findByPhone(input.login)
      : await this.identities.findByEmail(input.login);

    if (!(await this.passwords.verify(identity?.passwordHash ?? null, input.password)) || !identity) {
      throw new UnauthorizedException('Invalid login or password');
    }

    return this.tokens.issue(identity);
  }
}
