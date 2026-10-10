import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entity/product.entity.js';
import { ProductTranslation } from './entity/product-translation.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductTranslation])],
})
export class ProductModule {}
