import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entity/product.entity.js';
import { ProductTranslation } from './entity/product-translation.entity.js';
import { ProductRepository } from './repository/product.repository.js';
import { ProductTranslationRepository } from './repository/product-translation.repository.js';
import { ProductCreateCommandHandler } from './command-handler/product-create.command-handler.js';
import { ProductController } from './controller/product.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductTranslation])],
  controllers: [ProductController],
  providers: [ProductRepository, ProductTranslationRepository, ProductCreateCommandHandler],
})
export class ProductModule {}
