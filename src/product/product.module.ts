import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entity/product.entity.js';
import { ProductTranslation } from './entity/product-translation.entity.js';
import { ProductController } from './controller/product.controller.js';
import { ProductService } from './service/product.service.js';
import { ProductRepository } from './repository/product.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductTranslation])],
  controllers: [ProductController],
  providers: [ProductService, ProductRepository],
})
export class ProductModule {}
