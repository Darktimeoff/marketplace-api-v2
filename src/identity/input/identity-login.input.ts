import { IsString, MaxLength, MinLength } from 'class-validator';
import type { IdentityLoginRequestInterface } from '@marketplace/contracts-core';

export class IdentityLoginInput implements IdentityLoginRequestInterface {
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  login: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
