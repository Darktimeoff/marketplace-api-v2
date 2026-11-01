import { Expose, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsInt, IsPositive, IsString, IsUrl, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';
import {
  MediaKindEnum,
  MediaVariantNameEnum,
  type ProductMediaResponseInterface,
  type ProductMediaVariantResponseInterface,
  type ProductResponseInterface,
} from '@marketplace/contracts-core';

export class ProductMediaVariantDto implements ProductMediaVariantResponseInterface {
  @Expose()
  @IsEnum(MediaVariantNameEnum)
  name: MediaVariantNameEnum;

  @Expose()
  @IsString()
  mimeType: string;

  @Expose()
  @IsUrl({ require_tld: false })
  url: string;

  @Expose()
  @IsInt()
  @IsPositive()
  width: number;

  @Expose()
  @IsInt()
  @IsPositive()
  height: number;
}

export class ProductMediaDto implements ProductMediaResponseInterface {
  @Expose()
  @IsUUID()
  id: string;

  @Expose()
  @IsInt()
  @Min(0)
  position: number;

  @Expose()
  @IsEnum(MediaKindEnum)
  kind: MediaKindEnum;

  @Expose()
  @IsString()
  mimeType: string;

  @Expose()
  @IsUrl({ require_tld: false })
  url: string;

  @Expose()
  @ValidateIf((dto: ProductMediaDto) => dto.thumbHash !== null)
  @IsString()
  thumbHash: string | null;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaVariantDto)
  variants: ProductMediaVariantDto[];
}

export class ProductDto implements ProductResponseInterface {
  @Expose()
  @IsUUID()
  publicId: string;

  @Expose()
  @IsUUID()
  categoryPublicId: string;

  @Expose()
  @IsUUID()
  brandPublicId: string;

  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaDto)
  media: ProductMediaDto[];

  @Expose()
  @Type(() => Date)
  @IsDate()
  createdAt: Date;
}
