import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entity/category.entity.js';
import { CategoryTranslation } from './entity/category-translation.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Category, CategoryTranslation])],
})
export class CategoryModule {}
