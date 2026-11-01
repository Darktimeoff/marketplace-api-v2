import { Expose, Type } from 'class-transformer';
import { IsDate, IsObject, IsUrl } from 'class-validator';
import type { MediaUploadResponseInterface } from '@marketplace/contracts-core';
import { MediaDto } from './media.dto.js';

export class MediaUploadDto extends MediaDto implements MediaUploadResponseInterface {
  @Expose()
  @IsUrl({ require_tld: false })
  url: string;

  @Expose()
  @IsObject()
  headers: Record<string, string>;

  @Expose()
  @Type(() => Date)
  @IsDate()
  expiresAt: Date;
}
