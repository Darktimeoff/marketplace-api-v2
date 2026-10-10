import { IsString, Matches } from 'class-validator';
import type { IdentityRefreshTokenRequestInterface } from '@marketplace/contracts-core';

export class IdentityRefreshTokenInput implements IdentityRefreshTokenRequestInterface {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'refreshToken is malformed' })
  refreshToken: string;
}
