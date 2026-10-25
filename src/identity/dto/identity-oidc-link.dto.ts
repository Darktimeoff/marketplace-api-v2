import { Expose } from 'class-transformer';
import { IsUrl } from 'class-validator';
import type { IdentityOidcLinkResponseInterface } from '@marketplace/contracts-core';

export class IdentityOidcLinkDto implements IdentityOidcLinkResponseInterface {
  @Expose()
  @IsUrl({ require_tld: false })
  url: string;
}
