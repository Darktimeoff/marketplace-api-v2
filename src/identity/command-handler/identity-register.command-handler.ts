import { ConflictException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { QueryFailedError } from 'typeorm';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';
import { IdentityRepository } from '../repository/identity.repository.js';
import { PasswordService } from '../service/password.service.js';
import { TokenService } from '../service/token.service.js';
import { IdentityRegisterInput } from '../input/identity-register.input.js';
import { RoleEnum } from '../enum/role.enum.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class IdentityRegisterCommandHandler {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: IdentityRegisterInput): Promise<IdentityTokenResponseInterface> {
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.register(input, passwordHash);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('An identity with this email or phone already exists');
      }

      throw error;
    }
  }

  @Transactional()
  private async register(input: IdentityRegisterInput, passwordHash: string): Promise<IdentityTokenResponseInterface> {
    const identity = await this.identities.create({
      email: input.email ?? null,
      loginPhone: {
        countryCode: input.phone?.countryCode ?? null,
        rawNumber: input.phone?.rawNumber ?? null,
        fullNumber: input.phone?.fullNumber ?? null,
        nationalNumber: input.phone?.nationalNumber ?? null,
      },
      passwordHash,
      role: RoleEnum.user,
    });

    return this.tokens.createTokenPair(identity);
  }
}
