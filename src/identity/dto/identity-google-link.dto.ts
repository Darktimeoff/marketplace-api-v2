import { Expose } from 'class-transformer';
import { IsUrl } from 'class-validator';
import type { IdentityGoogleLinkResponseInterface } from '@marketplace/contracts-core';

export class IdentityGoogleLinkDto implements IdentityGoogleLinkResponseInterface {
  @Expose()
  @IsUrl({ require_tld: false })
  url: string;
}
