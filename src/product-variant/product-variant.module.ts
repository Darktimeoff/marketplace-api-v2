import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductVariant } from './entity/product-variant.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant])],
})
export class ProductVariantModule {}
