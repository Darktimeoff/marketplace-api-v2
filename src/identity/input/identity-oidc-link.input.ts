import { IsString, MaxLength, MinLength } from 'class-validator';
import type { IdentityOidcLinkRequestInterface } from '@marketplace/contracts-core';

export class IdentityOidcLinkInput implements IdentityOidcLinkRequestInterface {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
