import { Expose, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsPositive, IsString, IsUUID } from 'class-validator';
import { MediaKindEnum, MediaStatusEnum, type MediaResponseInterface } from '@marketplace/contracts-core';

export class MediaDto implements MediaResponseInterface {
  @Expose()
  @IsUUID()
  id: string;

  @Expose()
  @IsEnum(MediaKindEnum)
  kind: MediaKindEnum;

  @Expose()
  @IsEnum(MediaStatusEnum)
  status: MediaStatusEnum;

  @Expose()
  @IsString()
  mimeType: string;

  @Expose()
  @IsInt()
  @IsPositive()
  sizeBytes: number;

  @Expose()
  @Type(() => Date)
  @IsDate()
  createdAt: Date;
}
