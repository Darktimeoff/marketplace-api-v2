import { Expose, Type } from 'class-transformer';
import { IsDate, IsInt, IsPositive, IsUUID } from 'class-validator';
import type { ProductResponseInterface } from '@marketplace/contracts-core';

export class ProductDto implements ProductResponseInterface {
  @Expose()
  @IsUUID()
  publicId: string;

  @Expose()
  @IsInt()
  @IsPositive()
  categoryId: number;

  @Expose()
  @IsInt()
  @IsPositive()
  brandId: number;

  @Expose()
  @Type(() => Date)
  @IsDate()
  createdAt: Date;
}
