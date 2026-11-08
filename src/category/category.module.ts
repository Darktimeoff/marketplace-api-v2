import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entity/category.entity.js';
import { CategoryTranslation } from './entity/category-translation.entity.js';
import { CategoryRepository } from './repository/category.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Category, CategoryTranslation])],
  providers: [CategoryRepository],
  exports: [CategoryRepository],
})
export class CategoryModule {}
