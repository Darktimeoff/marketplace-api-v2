import { IsString, MaxLength, MinLength } from 'class-validator';
import type { IdentityGoogleLinkRequestInterface } from '@marketplace/contracts-core';

export class IdentityGoogleLinkInput implements IdentityGoogleLinkRequestInterface {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
