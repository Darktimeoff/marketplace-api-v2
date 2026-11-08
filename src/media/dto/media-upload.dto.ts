import { Expose, Type } from 'class-transformer';
import { IsDate, IsInt, IsObject, IsPositive, IsUrl, ValidateIf } from 'class-validator';
import type { MediaUploadResponseInterface } from '@marketplace/contracts-core';
import { MediaDto } from './media.dto.js';

export class MediaUploadDto extends MediaDto implements MediaUploadResponseInterface {
  @Expose()
  @ValidateIf((dto: MediaUploadDto) => dto.url !== null)
  @IsUrl({ require_tld: false })
  url: string | null;

  @Expose()
  @ValidateIf((dto: MediaUploadDto) => dto.headers !== null)
  @IsObject()
  headers: Record<string, string> | null;

  @Expose()
  @ValidateIf((dto: MediaUploadDto) => dto.expiresAt !== null)
  @Type(() => Date)
  @IsDate()
  expiresAt: Date | null;

  @Expose()
  @ValidateIf((dto: MediaUploadDto) => dto.partSize !== null)
  @IsInt()
  @IsPositive()
  partSize: number | null;

  @Expose()
  @ValidateIf((dto: MediaUploadDto) => dto.partCount !== null)
  @IsInt()
  @IsPositive()
  partCount: number | null;
}
