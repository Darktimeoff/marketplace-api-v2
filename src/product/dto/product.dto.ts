import { Expose, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsInt, IsString, IsUrl, IsUUID, Min, ValidateNested } from 'class-validator';
import { MediaKindEnum, type ProductMediaResponseInterface, type ProductResponseInterface } from '@marketplace/contracts-core';

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
