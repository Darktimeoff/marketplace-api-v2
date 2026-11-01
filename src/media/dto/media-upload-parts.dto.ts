import { Expose, Type } from 'class-transformer';
import { IsArray, IsDate, IsInt, IsPositive, IsUrl, IsUUID, Min, ValidateNested } from 'class-validator';
import type { MediaUploadPartResponseInterface, MediaUploadPartsResponseInterface } from '@marketplace/contracts-core';

export class MediaUploadPartDto implements MediaUploadPartResponseInterface {
  @Expose()
  @IsInt()
  @IsPositive()
  partNumber: number;

  @Expose()
  @IsUrl({ require_tld: false })
  url: string;
}

export class MediaUploadPartsDto implements MediaUploadPartsResponseInterface {
  @Expose()
  @IsUUID()
  id: string;

  @Expose()
  @IsInt()
  @IsPositive()
  partSize: number;

  @Expose()
  @IsInt()
  @IsPositive()
  partCount: number;

  @Expose()
  @IsInt()
  @Min(0)
  uploadedPartCount: number;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaUploadPartDto)
  parts: MediaUploadPartDto[];

  @Expose()
  @Type(() => Date)
  @IsDate()
  expiresAt: Date;
}
